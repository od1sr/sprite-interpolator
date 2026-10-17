from dataclasses import replace
from uuid import UUID, uuid4

from sqlalchemy import select

from app.models import Job, Result, Video


def upload(client, monkeypatch):
    from app import api

    monkeypatch.setattr(
        api,
        "probe_video",
        lambda _: {
            "duration_seconds": 2.5,
            "width": 1280,
            "height": 720,
            "fps": 30.0,
            "codec": "h264",
        },
    )
    return client.post(
        "/api/v1/videos",
        files={"file": ("source.mp4", b"test video content", "video/mp4")},
    )


def test_upload_list_and_get_video(client, monkeypatch):
    test_client, _ = client
    response = upload(test_client, monkeypatch)

    assert response.status_code == 201
    video = response.json()
    assert video["filename"] == "source.mp4"
    assert video["duration_seconds"] == 2.5
    assert video["created_at"].endswith("Z")
    assert "storage_key" not in video
    assert test_client.get("/api/v1/videos").json()["total"] == 1
    assert test_client.get(f"/api/v1/videos/{video['id']}").json()["id"] == video["id"]


def test_upload_rejects_unsupported_file_without_writing_to_storage(client, monkeypatch):
    test_client, _ = client
    from app import api

    response = test_client.post(
        "/api/v1/videos",
        files={"file": ("malware.exe", b"not a video", "application/octet-stream")},
    )
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"
    assert not list((api.settings.storage_root / "uploads").iterdir())


def test_upload_rejects_unreadable_video(client, monkeypatch):
    test_client, sessions = client
    from app import api
    from app.errors import APIError

    def reject_video(_):
        raise APIError(422, "VALIDATION_ERROR", "Файл не является читаемым видео")

    monkeypatch.setattr(api, "probe_video", reject_video)
    response = test_client.post(
        "/api/v1/videos",
        files={"file": ("broken.mp4", b"invalid", "video/mp4")},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    with sessions() as session:
        assert session.scalar(select(Video)) is None


def test_upload_enforces_configured_size_and_removes_temporary_file(client, monkeypatch):
    test_client, sessions = client
    from app import api

    monkeypatch.setattr(api, "settings", replace(api.settings, max_upload_bytes=4))
    response = test_client.post(
        "/api/v1/videos",
        files={"file": ("large.mp4", b"12345", "video/mp4")},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "VIDEO_TOO_LARGE"
    assert not list((api.settings.storage_root / "uploads").iterdir())
    with sessions() as session:
        assert session.scalar(select(Video)) is None


def test_create_job_validates_pipeline_and_enqueues(client, monkeypatch):
    test_client, sessions = client
    upload_response = upload(test_client, monkeypatch)
    from app import api

    submitted = []
    monkeypatch.setattr(api.process_job, "apply_async", lambda args: submitted.append(args))
    response = test_client.post(
        "/api/v1/jobs",
        json={
            "video_id": upload_response.json()["id"],
            "steps": [
                {"type": "upscale", "parameters": {"scale": 2}},
                {"type": "interpolate", "parameters": {"target_fps": 60}},
            ],
        },
    )

    assert response.status_code == 202
    job = response.json()
    assert job["status"] == "queued"
    assert [step["status"] for step in job["steps"]] == ["queued", "queued"]
    assert submitted == [[job["id"]]]
    assert job["created_at"].endswith("Z")

    invalid = test_client.post(
        "/api/v1/jobs",
        json={"video_id": upload_response.json()["id"], "steps": []},
    )
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "VALIDATION_ERROR"
    with sessions() as session:
        assert len(session.scalars(select(Job)).all()) == 1


def test_queue_failure_returns_503_and_removes_unqueued_job(client, monkeypatch):
    test_client, sessions = client
    video_id = upload(test_client, monkeypatch).json()["id"]
    from app import api

    def fail_enqueue(*_, **__):
        raise ConnectionError("broker unavailable")

    monkeypatch.setattr(api.process_job, "apply_async", fail_enqueue)
    response = test_client.post(
        "/api/v1/jobs",
        json={"video_id": video_id, "steps": [{"type": "upscale", "parameters": {"scale": 2}}]},
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
    with sessions() as session:
        assert session.scalar(select(Job)) is None


def test_cancel_queued_job_and_reject_active_video_deletion(client, monkeypatch):
    test_client, _ = client
    video = upload(test_client, monkeypatch).json()
    from app import api

    monkeypatch.setattr(api.process_job, "apply_async", lambda **_: None)
    job = test_client.post(
        "/api/v1/jobs",
        json={"video_id": video["id"], "steps": [{"type": "upscale", "parameters": {"scale": 2}}]},
    ).json()
    cancelled = test_client.post(f"/api/v1/jobs/{job['id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["steps"][0]["status"] == "cancelled"
    assert test_client.delete(f"/api/v1/videos/{video['id']}").status_code == 409


def test_retry_creates_a_new_job_for_retryable_failure(client, monkeypatch):
    test_client, sessions = client
    video = upload(test_client, monkeypatch).json()
    from app import api

    with sessions.begin() as session:
        failed = Job(
            video_id=UUID(video["id"]),
            status="failed",
            steps=[
                {
                    "type": "upscale",
                    "status": "failed",
                    "parameters": {"scale": 2},
                    "progress": 0,
                    "started_at": None,
                    "finished_at": None,
                    "error": None,
                }
            ],
            error={"code": "AI_SERVICE_UNAVAILABLE", "retryable": True},
        )
        session.add(failed)
        session.flush()
        failed_id = failed.id

    enqueued = []
    monkeypatch.setattr(api.process_job, "apply_async", lambda args: enqueued.append(args))
    response = test_client.post(f"/api/v1/jobs/{failed_id}/retry")
    assert response.status_code == 202
    retry = response.json()
    assert retry["id"] != str(failed_id)
    assert retry["status"] == "queued"
    assert retry["steps"][0]["status"] == "queued"
    assert enqueued == [[retry["id"]]]


def test_completed_job_without_file_returns_resource_gone(client):
    test_client, sessions = client
    with sessions.begin() as session:
        video = Video(
            filename="source.mp4",
            content_type="video/mp4",
            size_bytes=10,
            storage_key="uploads/source.mp4",
        )
        job = Job(video=video, status="completed", steps=[], progress=100)
        session.add_all([video, job])
        session.flush()
        result = Result(
            job_id=job.id,
            filename="render.mp4",
            content_type="video/mp4",
            size_bytes=1,
            storage_key=f"results/{job.id}/render.mp4",
        )
        session.add(result)
        session.flush()
        job.result_id = result.id
        job_id = job.id

    response = test_client.get(f"/api/v1/jobs/{job_id}/result")
    assert response.status_code == 410
    assert response.json()["error"]["code"] == "RESOURCE_GONE"


def test_deleting_terminal_job_removes_its_result_and_database_rows(client):
    test_client, sessions = client
    with sessions.begin() as session:
        video = Video(
            filename="source.mp4",
            content_type="video/mp4",
            size_bytes=10,
            storage_key="uploads/source.mp4",
        )
        job = Job(video=video, status="completed", steps=[], progress=100)
        session.add_all([video, job])
        session.flush()
        result = Result(
            job_id=job.id,
            filename="render.mp4",
            content_type="video/mp4",
            size_bytes=7,
            storage_key=f"results/{job.id}/render.mp4",
        )
        session.add(result)
        session.flush()
        job.result_id = result.id
        job_id = job.id

    from app import api

    result_path = api.settings.storage_root / "results" / str(job_id) / "render.mp4"
    result_path.parent.mkdir(parents=True)
    result_path.write_bytes(b"render!")
    response = test_client.delete(f"/api/v1/jobs/{job_id}")
    assert response.status_code == 204
    assert not result_path.exists()
    with sessions() as session:
        assert session.get(Job, job_id) is None
        assert session.scalar(select(Result)) is None


def test_result_metadata_and_download(client):
    test_client, sessions = client
    with sessions.begin() as session:
        video = Video(
            filename="source.mp4",
            content_type="video/mp4",
            size_bytes=10,
            storage_key="uploads/source.mp4",
        )
        job = Job(
            video=video,
            status="completed",
            steps=[],
            progress=100,
        )
        session.add_all([video, job])
        session.flush()
        result = Result(
            job_id=job.id,
            filename="render.mp4",
            content_type="video/mp4",
            size_bytes=7,
            storage_key=f"results/{job.id}/render.mp4",
        )
        session.add(result)
        session.flush()
        job.result_id = result.id
        job_id = job.id

    from app import api

    result_path = api.settings.storage_root / "results" / str(job_id) / "render.mp4"
    result_path.parent.mkdir(parents=True)
    result_path.write_bytes(b"render!")
    metadata = test_client.get(f"/api/v1/jobs/{job_id}/result")
    assert metadata.status_code == 200
    assert metadata.json()["download_url"].endswith("/result/download")
    download = test_client.get(f"/api/v1/jobs/{job_id}/result/download")
    assert download.status_code == 200
    assert download.content == b"render!"


def test_missing_resources_and_invalid_uuid_use_error_envelope(client):
    test_client, _ = client
    invalid_uuid = test_client.get("/api/v1/videos/not-a-uuid")
    assert invalid_uuid.status_code == 422
    assert invalid_uuid.json()["error"]["code"] == "VALIDATION_ERROR"
    missing_job = test_client.get(f"/api/v1/jobs/{uuid4()}")
    assert missing_job.status_code == 404
    assert missing_job.json()["error"]["code"] == "RESOURCE_NOT_FOUND"
