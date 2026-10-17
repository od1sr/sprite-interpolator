from pathlib import Path
from uuid import uuid4

import pytest
from httpx import Request, Response
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Job, Video


@pytest.fixture
def worker_context(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from app import worker
    from app.config import Settings

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    root = tmp_path / "storage"
    root.mkdir()
    monkeypatch.setattr(worker, "SessionLocal", sessions)
    monkeypatch.setattr(worker, "settings", Settings(database_url="sqlite://", storage_root=root))

    video_id = uuid4()
    job_id = uuid4()
    source_key = f"uploads/{video_id}.mp4"
    source_path = root / source_key
    source_path.parent.mkdir(parents=True)
    source_path.write_bytes(b"source")
    with sessions.begin() as session:
        session.add(
            Video(
                id=video_id,
                filename="input.mp4",
                content_type="video/mp4",
                size_bytes=6,
                storage_key=source_key,
            )
        )
        session.add(
            Job(
                id=job_id,
                video_id=video_id,
                status="queued",
                steps=[
                    {
                        "type": "upscale",
                        "status": "queued",
                        "parameters": {"scale": 2},
                        "progress": 0,
                        "started_at": None,
                        "finished_at": None,
                        "error": None,
                    }
                ],
            )
        )
    yield worker, sessions, root, job_id
    engine.dispose()


def test_worker_processes_pipeline_and_persists_result(worker_context, monkeypatch):
    worker, sessions, root, job_id = worker_context

    def fake_ai_call(step_type, input_path, output_path, parameters):
        assert step_type == "upscale"
        assert input_path.name.endswith(".mp4")
        assert parameters == {"scale": 2}
        output_path.write_bytes(b"processed")
        return {
            "status": "completed",
            "output_uri": str(output_path),
            "size_bytes": len(b"processed"),
            "duration_seconds": 2.5,
            "width": 2560,
            "height": 1440,
            "fps": 30,
        }

    monkeypatch.setattr(worker, "_call_ai", fake_ai_call)
    worker.process_job.run(str(job_id))

    with sessions() as session:
        job = session.scalar(select(Job).where(Job.id == job_id))
        assert job.status == "completed"
        assert job.progress == 100
        assert job.steps[0]["status"] == "completed"
        assert job.result is not None
        result_path = root / job.result.storage_key
        assert result_path.read_bytes() == b"processed"
        assert (root / "uploads" / f"{job.video_id}.mp4").is_file()
    assert not (root / "jobs" / str(job_id)).exists()


def test_ai_client_uses_documented_request_and_validates_shared_output(worker_context, monkeypatch):
    worker, _, root, _ = worker_context
    output_path = root / "jobs" / "ai-output.mp4"
    output_path.parent.mkdir()
    seen = {}

    def fake_post(url, *, json, timeout):
        seen.update(url=url, request=json, timeout=timeout)
        output_path.write_bytes(b"output")
        return Response(
            200,
            request=Request("POST", url),
            json={
                "status": "completed",
                "output_uri": str(output_path),
                "size_bytes": 6,
                "duration_seconds": 2.5,
                "width": 1280,
                "height": 720,
                "fps": 60,
            },
        )

    monkeypatch.setattr(worker.httpx, "post", fake_post)
    result = worker._call_ai("interpolate", root / "input.mp4", output_path, {"target_fps": 60})

    assert seen["url"].endswith("/internal/v1/interpolate")
    assert seen["request"] == {
        "input_uri": str(root / "input.mp4"),
        "output_uri": str(output_path),
        "params": {"target_fps": 60},
    }
    assert result["status"] == "completed"


def test_worker_records_retryable_ai_failure(worker_context, monkeypatch):
    worker, sessions, _, job_id = worker_context

    def fail_ai_call(*_):
        raise worker.PipelineFailure(
            "AI_SERVICE_UNAVAILABLE",
            "AI Service недоступен",
            True,
            "upscale",
        )

    monkeypatch.setattr(worker, "_call_ai", fail_ai_call)
    worker.process_job.run(str(job_id))

    with sessions() as session:
        job = session.scalar(select(Job).where(Job.id == job_id))
        assert job.status == "failed"
        assert job.error["retryable"] is True
        assert job.error["stage"] == "upscale"
        assert job.steps[0]["status"] == "failed"
        assert job.steps[0]["error"]["code"] == "AI_SERVICE_UNAVAILABLE"


def test_worker_stops_after_a_cancellation_during_ai_processing(worker_context, monkeypatch):
    worker, sessions, root, job_id = worker_context

    def cancel_during_ai(_step_type, _input_path, output_path, _parameters):
        with sessions.begin() as session:
            job = session.scalar(select(Job).where(Job.id == job_id))
            job.status = "cancelling"
        output_path.write_bytes(b"partial result")
        return {
            "status": "completed",
            "output_uri": str(output_path),
            "size_bytes": len(b"partial result"),
            "duration_seconds": 2.5,
            "width": 2560,
            "height": 1440,
            "fps": 30,
        }

    monkeypatch.setattr(worker, "_call_ai", cancel_during_ai)
    worker.process_job.run(str(job_id))

    with sessions() as session:
        job = session.scalar(select(Job).where(Job.id == job_id))
        assert job.status == "cancelled"
        assert job.finished_at is not None
        assert job.steps[0]["status"] == "cancelled"
        assert job.result is None
    assert not (root / "jobs" / str(job_id)).exists()


def test_cancellation_wins_if_ai_fails_after_cancellation_was_requested(worker_context, monkeypatch):
    worker, sessions, _, job_id = worker_context

    def fail_after_cancel_request(*_):
        with sessions.begin() as session:
            job = session.scalar(select(Job).where(Job.id == job_id))
            job.status = "cancelling"
        raise worker.PipelineFailure("AI_PROCESSING_ERROR", "Не удалось обработать видео", False, "upscale")

    monkeypatch.setattr(worker, "_call_ai", fail_after_cancel_request)
    worker.process_job.run(str(job_id))

    with sessions() as session:
        job = session.scalar(select(Job).where(Job.id == job_id))
        assert job.status == "cancelled"
        assert job.error is None
        assert job.steps[0]["status"] == "cancelled"
        assert job.steps[0]["error"] is None
