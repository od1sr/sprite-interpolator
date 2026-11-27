from dataclasses import replace
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from app.models import ExportJob, Job, Result, User, Video
from app.storage import user_relative_path


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


def test_color_preview_proxies_ai_frames(client, monkeypatch):
    from app import api

    test_client, _ = client
    video_id = upload(test_client, monkeypatch).json()["id"]
    calls = []

    class FakeResponse:
        is_error = False

        @staticmethod
        def json():
            return {
                "status": "completed",
                "before_base64": "before",
                "after_base64": "after",
            }

    def fake_post(url, json, timeout):
        calls.append((url, json, timeout))
        return FakeResponse()

    monkeypatch.setattr(api.httpx, "post", fake_post)

    response = test_client.post(
        f"/api/v1/videos/{video_id}/color-preview",
        json={"mode": "preset", "preset": "cinema"},
    )
    assert response.status_code == 200
    assert response.json() == {"before": "before", "after": "after"}
    assert calls[0][1]["params"] == {"mode": "preset", "preset": "cinema", "sharpness": 0}

    response = test_client.post(
        f"/api/v1/videos/{video_id}/color-preview",
        json={"mode": "preset", "preset": None, "sharpness": 45},
    )
    assert response.status_code == 200
    assert calls[1][1]["params"] == {"mode": "preset", "preset": None, "sharpness": 45}

    response = test_client.post(
        f"/api/v1/videos/{video_id}/color-preview",
        json={"mode": "smart", "sharpness": 60},
    )
    assert response.status_code == 200
    assert calls[2][1]["params"] == {"mode": "smart", "preset": None, "sharpness": 60}


def test_color_preview_rejects_out_of_range_sharpness(client, monkeypatch):
    test_client, _ = client
    video_id = upload(test_client, monkeypatch).json()["id"]

    response = test_client.post(
        f"/api/v1/videos/{video_id}/color-preview",
        json={"mode": "preset", "sharpness": 101},
    )
    assert response.status_code == 422


def test_color_preview_rejects_unknown_preset(client, monkeypatch):
    test_client, _ = client
    video_id = upload(test_client, monkeypatch).json()["id"]

    response = test_client.post(
        f"/api/v1/videos/{video_id}/color-preview",
        json={"mode": "preset", "preset": "unknown"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


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


def test_create_job_accepts_color_correction_and_orders_steps(client, monkeypatch):
    test_client, _ = client
    from app import api

    monkeypatch.setattr(api.process_job, "apply_async", lambda args: None)
    video_id = upload(test_client, monkeypatch).json()["id"]
    response = test_client.post(
        "/api/v1/jobs",
        json={
            "video_id": video_id,
            "steps": [
                {"type": "color_correct", "parameters": {"mode": "preset", "preset": "cinema"}},
                {"type": "upscale", "parameters": {"scale": 2}},
                {"type": "interpolate", "parameters": {"target_fps": 60}},
            ],
        },
    )
    assert response.status_code == 202
    steps = response.json()["steps"]
    assert [step["type"] for step in steps] == ["interpolate", "upscale", "color_correct"]
    assert steps[2]["parameters"] == {"mode": "preset", "preset": "cinema"}

    smart = test_client.post(
        "/api/v1/jobs",
        json={
            "video_id": video_id,
            "steps": [{"type": "color_correct", "parameters": {"mode": "smart"}}],
        },
    )
    assert smart.status_code == 202
    assert smart.json()["steps"][0]["parameters"] == {"mode": "smart"}


def test_create_job_accepts_sharpness_only_color_step(client, monkeypatch):
    test_client, _ = client
    from app import api

    monkeypatch.setattr(api.process_job, "apply_async", lambda args: None)
    video_id = upload(test_client, monkeypatch).json()["id"]

    response = test_client.post(
        "/api/v1/jobs",
        json={
            "video_id": video_id,
            "steps": [{"type": "color_correct", "parameters": {"mode": "preset", "sharpness": 50}}],
        },
    )
    assert response.status_code == 202
    assert response.json()["steps"][0]["parameters"] == {"mode": "preset", "sharpness": 50}


@pytest.mark.parametrize(
    "parameters",
    [
        {"mode": "preset", "preset": "unknown"},
        {"mode": "preset"},
        {"mode": "smart", "preset": "cinema"},
        {"mode": "auto"},
        {"mode": "preset", "preset": "cinema", "brightness": 10},
        {"mode": "preset", "preset": "cinema", "sharpness": 101},
        {"mode": "smart", "sharpness": -1},
    ],
)
def test_create_job_rejects_invalid_color_parameters(client, monkeypatch, parameters):
    test_client, sessions = client
    from app import api

    monkeypatch.setattr(api.process_job, "apply_async", lambda args: None)
    video_id = upload(test_client, monkeypatch).json()["id"]
    response = test_client.post(
        "/api/v1/jobs",
        json={"video_id": video_id, "steps": [
            {"type": "color_correct", "parameters": parameters},
        ]},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    with sessions() as session:
        assert session.scalar(select(Job)) is None


def test_create_job_rejects_unsupported_fps_multiplier(client, monkeypatch):
    test_client, sessions = client
    from app import api

    monkeypatch.setattr(api.process_job, "apply_async", lambda args: None)
    monkeypatch.setattr(
        api,
        "probe_video",
        lambda _: {
            "duration_seconds": 2.5,
            "width": 1280,
            "height": 720,
            "fps": 12.0,
            "codec": "h264",
        },
    )
    video = test_client.post(
        "/api/v1/videos",
        files={"file": ("source12.mp4", b"test video content", "video/mp4")},
    ).json()

    response = test_client.post(
        "/api/v1/jobs",
        json={
            "video_id": video["id"],
            "steps": [{"type": "interpolate", "parameters": {"target_fps": 60}}],
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert response.json()["error"]["details"]["allowed_target_fps"] == [24.0, 48.0, 96.0, 192.0]
    with sessions() as session:
        assert session.scalar(select(Job)) is None

    valid = test_client.post(
        "/api/v1/jobs",
        json={
            "video_id": video["id"],
            "steps": [{"type": "interpolate", "parameters": {"target_fps": 96}}],
        },
    )
    assert valid.status_code == 202


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


def test_retry_creates_a_new_job_for_retryable_failure(client, monkeypatch, user):
    test_client, sessions = client
    video = upload(test_client, monkeypatch).json()
    from app import api

    with sessions.begin() as session:
        failed = Job(
            user_id=user.id,
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


def test_completed_job_without_file_returns_resource_gone(client, user):
    test_client, sessions = client
    with sessions.begin() as session:
        video = Video(
            user_id=user.id,
            filename="source.mp4",
            content_type="video/mp4",
            size_bytes=10,
            storage_key=user_relative_path(user.id, "uploads", "source.mp4").as_posix(),
        )
        job = Job(
            user_id=user.id,
            video=video,
            status="completed",
            steps=[],
            progress=100,
        )
        session.add_all([video, job])
        session.flush()
        result = Result(
            user_id=user.id,
            job_id=job.id,
            filename="render.mp4",
            content_type="video/mp4",
            size_bytes=1,
            storage_key=user_relative_path(user.id, "results", str(job.id), "render.mp4").as_posix(),
        )
        session.add(result)
        session.flush()
        job.result_id = result.id
        job_id = job.id

    response = test_client.get(f"/api/v1/jobs/{job_id}/result")
    assert response.status_code == 410
    assert response.json()["error"]["code"] == "RESOURCE_GONE"


def test_deleting_terminal_job_removes_its_result_and_database_rows(client, user):
    test_client, sessions = client
    with sessions.begin() as session:
        video = Video(
            user_id=user.id,
            filename="source.mp4",
            content_type="video/mp4",
            size_bytes=10,
            storage_key=user_relative_path(user.id, "uploads", "source.mp4").as_posix(),
        )
        job = Job(
            user_id=user.id,
            video=video,
            status="completed",
            steps=[],
            progress=100,
        )
        session.add_all([video, job])
        session.flush()
        result = Result(
            user_id=user.id,
            job_id=job.id,
            filename="render.mp4",
            content_type="video/mp4",
            size_bytes=7,
            storage_key=user_relative_path(user.id, "results", str(job.id), "render.mp4").as_posix(),
        )
        session.add(result)
        session.flush()
        job.result_id = result.id
        job_id = job.id

    from app import api

    result_path = api.settings.storage_root / user_relative_path(
        user.id, "results", str(job_id), "render.mp4"
    )
    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.write_bytes(b"render!")
    response = test_client.delete(f"/api/v1/jobs/{job_id}")
    assert response.status_code == 204
    assert not result_path.exists()
    with sessions() as session:
        assert session.get(Job, job_id) is None
        assert session.scalar(select(Result)) is None


def test_result_metadata_and_download(client, user):
    test_client, sessions = client
    with sessions.begin() as session:
        video = Video(
            user_id=user.id,
            filename="source.mp4",
            content_type="video/mp4",
            size_bytes=10,
            storage_key=user_relative_path(user.id, "uploads", "source.mp4").as_posix(),
        )
        job = Job(
            user_id=user.id,
            video=video,
            status="completed",
            steps=[],
            progress=100,
        )
        session.add_all([video, job])
        session.flush()
        result = Result(
            user_id=user.id,
            job_id=job.id,
            filename="render.mp4",
            content_type="video/mp4",
            size_bytes=7,
            storage_key=user_relative_path(user.id, "results", str(job.id), "render.mp4").as_posix(),
        )
        session.add(result)
        session.flush()
        job.result_id = result.id
        job_id = job.id

    from app import api

    result_path = api.settings.storage_root / user_relative_path(
        user.id, "results", str(job_id), "render.mp4"
    )
    result_path.parent.mkdir(parents=True, exist_ok=True)
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


def test_create_export_enqueues_and_returns_backend_status(client, monkeypatch):
    test_client, _ = client
    video_id = upload(test_client, monkeypatch).json()["id"]
    from app import api

    enqueued = []
    monkeypatch.setattr(api.process_export_job, "apply_async", lambda args: enqueued.append(args))
    response = test_client.post(
        f"/api/v1/videos/{video_id}/exports",
        json={"profile_id": "tiktok_vertical_v1", "adaptation_mode": "pad"},
    )

    assert response.status_code == 202
    export = response.json()
    assert export["status"] == "queued"
    assert export["profile_id"] == "tiktok_vertical_v1"
    assert enqueued == [[export["id"]]]
    polled = test_client.get(f"/api/v1/exports/{export['id']}")
    assert polled.status_code == 200
    assert polled.json()["id"] == export["id"]


def test_create_export_waits_for_linked_processing_job(client, monkeypatch):
    test_client, sessions = client
    video_id = upload(test_client, monkeypatch).json()["id"]
    from app import api

    monkeypatch.setattr(api.process_job, "apply_async", lambda args: None)
    job_id = test_client.post(
        "/api/v1/jobs",
        json={
            "video_id": video_id,
            "steps": [{"type": "interpolate", "parameters": {"target_fps": 60}}],
        },
    ).json()["id"]

    enqueued = []
    monkeypatch.setattr(api.process_export_job, "apply_async", lambda args: enqueued.append(args))
    payload = {"profile_id": "youtube_standard_v1", "adaptation_mode": "crop", "job_id": job_id}
    pending = test_client.post(f"/api/v1/videos/{video_id}/exports", json=payload)
    assert pending.status_code == 202
    assert pending.json()["status"] == "queued"
    assert enqueued == []

    with sessions.begin() as session:
        session.get(Job, UUID(job_id)).status = "completed"
    ready = test_client.post(f"/api/v1/videos/{video_id}/exports", json=payload)
    assert ready.status_code == 202
    assert enqueued == [[ready.json()["id"]]]


def test_export_queue_failure_does_not_leave_a_queued_record(client, monkeypatch):
    test_client, sessions = client
    video_id = upload(test_client, monkeypatch).json()["id"]
    from app import api

    def fail_enqueue(*_, **__):
        raise ConnectionError("broker unavailable")

    monkeypatch.setattr(api.process_export_job, "apply_async", fail_enqueue)
    response = test_client.post(
        f"/api/v1/videos/{video_id}/exports",
        json={"profile_id": "tiktok_vertical_v1", "adaptation_mode": "crop"},
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
    with sessions() as session:
        assert session.scalar(select(ExportJob)) is None


def test_export_download_requires_ready_job_and_serves_output(client, user):
    test_client, sessions = client
    from app import api

    output_key = user_relative_path(user.id, "exports", "test", "result.mp4").as_posix()
    with sessions.begin() as session:
        video = Video(
            user_id=user.id,
            filename="source.mp4",
            content_type="video/mp4",
            size_bytes=10,
            storage_key=user_relative_path(user.id, "uploads", "source.mp4").as_posix(),
        )
        session.add(video)
        session.flush()
        export = ExportJob(
            user_id=user.id,
            video_id=video.id,
            profile_id="youtube_standard_v1",
            config_snapshot={},
            adaptation_mode="pad",
            status="queued",
        )
        session.add(export)
        session.flush()
        export_id = export.id

    not_ready = test_client.get(f"/api/v1/exports/{export_id}/download")
    assert not_ready.status_code == 409

    output_path = api.settings.storage_root / output_key
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(b"rendered")
    with sessions.begin() as session:
        export = session.get(ExportJob, export_id)
        export.status = "ready"
        export.output_path = output_key

    downloaded = test_client.get(f"/api/v1/exports/{export_id}/download")
    assert downloaded.status_code == 200
    assert downloaded.content == b"rendered"


def test_list_jobs_returns_projects_with_nested_exports(client, monkeypatch):
    test_client, _ = client
    video_id = upload(test_client, monkeypatch).json()["id"]
    from app import api

    monkeypatch.setattr(api.process_job, "apply_async", lambda args: None)
    monkeypatch.setattr(api.process_export_job, "apply_async", lambda args: None)
    steps = [{"type": "interpolate", "parameters": {"target_fps": 60}}]
    first = test_client.post(
        "/api/v1/jobs",
        json={"video_id": video_id, "steps": steps},
    ).json()
    second = test_client.post(
        "/api/v1/jobs",
        json={"video_id": video_id, "steps": steps},
    ).json()
    export = test_client.post(
        f"/api/v1/videos/{video_id}/exports",
        json={
            "profile_id": "youtube_standard_v1",
            "adaptation_mode": "crop",
            "job_id": second["id"],
        },
    ).json()

    projects = test_client.get("/api/v1/jobs").json()
    assert projects["total"] == 2
    assert {item["id"] for item in projects["items"]} == {first["id"], second["id"]}
    assert all(item["video_filename"] == "source.mp4" for item in projects["items"])
    second_project = next(item for item in projects["items"] if item["id"] == second["id"])
    assert [item["id"] for item in second_project["exports"]] == [export["id"]]
    first_project = next(item for item in projects["items"] if item["id"] == first["id"])
    assert first_project["exports"] == []


def test_register_login_me_and_duplicate_username(client):
    test_client, sessions = client
    from app import api

    test_client.cookies.clear()
    assert test_client.get("/api/v1/auth/me").status_code == 401

    registered = test_client.post(
        "/api/v1/auth/register",
        json={"username": "NewUser", "password": "password123", "display_name": "New"},
    )
    assert registered.status_code == 201
    assert registered.json()["username"] == "newuser"
    assert "password" not in registered.json()
    assert test_client.get("/api/v1/auth/me").json()["username"] == "newuser"

    duplicate = test_client.post(
        "/api/v1/auth/register",
        json={"username": "newuser", "password": "password123"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "USERNAME_TAKEN"

    with sessions() as session:
        stored_hash = session.scalar(
            select(User).where(User.username == "newuser")
        ).password_hash
    assert stored_hash != "password123"

    test_client.post("/api/v1/auth/logout")
    assert test_client.get("/api/v1/auth/me").status_code == 401
    assert test_client.post(
        "/api/v1/auth/login", json={"username": "newuser", "password": "wrong"}
    ).status_code == 401
    logged_in = test_client.post(
        "/api/v1/auth/login", json={"username": "newuser", "password": "password123"}
    )
    assert logged_in.status_code == 200
    assert test_client.get("/api/v1/auth/me").status_code == 200


def test_users_cannot_see_or_use_another_users_resources(client, monkeypatch, user):
    test_client, sessions = client
    from app import api
    from app.auth import create_access_token, hash_password
    from app.models import User

    video_id = upload(test_client, monkeypatch).json()["id"]
    monkeypatch.setattr(api.process_job, "apply_async", lambda args: None)
    job_id = test_client.post(
        "/api/v1/jobs",
        json={"video_id": video_id, "steps": [{"type": "upscale", "parameters": {"scale": 2}}]},
    ).json()["id"]
    export_id = test_client.post(
        f"/api/v1/videos/{video_id}/exports",
        json={"profile_id": "youtube_standard_v1", "adaptation_mode": "crop"},
    ).json()["id"]

    with sessions.begin() as session:
        other = User(username="other", password_hash=hash_password("password123"))
        session.add(other)
        session.flush()
        other_id = other.id

    test_client.cookies.set(api.settings.auth_cookie_name, create_access_token(other_id))
    assert test_client.get("/api/v1/videos").json()["total"] == 0
    assert test_client.get("/api/v1/jobs").json()["total"] == 0
    assert test_client.get(f"/api/v1/videos/{video_id}").status_code == 404
    assert test_client.get(f"/api/v1/jobs/{job_id}").status_code == 404
    assert test_client.get(f"/api/v1/exports/{export_id}").status_code == 404
    assert test_client.get(f"/api/v1/exports/{export_id}/download").status_code == 404
    assert test_client.post(
        "/api/v1/jobs",
        json={"video_id": video_id, "steps": [{"type": "upscale", "parameters": {"scale": 2}}]},
    ).status_code == 404
    assert test_client.post(
        f"/api/v1/videos/{video_id}/exports",
        json={"profile_id": "youtube_standard_v1", "adaptation_mode": "crop"},
    ).status_code == 404

    test_client.cookies.set(api.settings.auth_cookie_name, create_access_token(user.id))
    assert test_client.get("/api/v1/videos").json()["total"] == 1
    assert test_client.get("/api/v1/jobs").json()["total"] == 1
