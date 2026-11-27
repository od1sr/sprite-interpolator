from uuid import UUID

import pytest
from sqlalchemy import select

from app.billing import refund_job
from app.config import EXPORT_PROFILES, EXPORT_TOKEN_COST
from app.models import ExportJob, Job, User, Video
from app.pricing import PricingError, estimate_job_cost, fps_coefficient, resolution_coefficient


def _upload(client, monkeypatch, **metadata):
    from app import api

    probe = {
        "duration_seconds": 60.0,
        "width": 1920,
        "height": 1080,
        "fps": 30.0,
        "codec": "h264",
    }
    probe.update(metadata)
    monkeypatch.setattr(api, "probe_video", lambda _: probe)
    return client.post(
        "/api/v1/videos",
        files={"file": ("source.mp4", b"test video content", "video/mp4")},
    )


def _set_balance(sessions, user_id, value):
    with sessions() as session:
        account = session.get(User, user_id)
        account.token_balance = value
        session.commit()


def test_resolution_categories_use_frame_area():
    assert resolution_coefficient(640, 480)["coefficient"] == 0.5
    assert resolution_coefficient(854, 480)["coefficient"] == 0.5
    assert resolution_coefficient(1280, 720)["coefficient"] == 0.75
    assert resolution_coefficient(1920, 1080)["coefficient"] == 1.0
    assert resolution_coefficient(2560, 1440)["coefficient"] == 1.5
    assert resolution_coefficient(3840, 2160)["coefficient"] == 2.5
    # Square frame: classified by its pixel count, not by the height label.
    assert resolution_coefficient(1080, 1080)["coefficient"] == 1.0
    with pytest.raises(PricingError) as exc:
        resolution_coefficient(4096, 2160)
    assert exc.value.code == "UNSUPPORTED_RESOLUTION"


def test_fps_categories_include_fractional_rates():
    assert fps_coefficient(29.97) == 1.0
    assert fps_coefficient(30) == 1.0
    assert fps_coefficient(59.94) == 1.5
    assert fps_coefficient(120) == 2.5
    with pytest.raises(PricingError) as exc:
        fps_coefficient(120.5)
    assert exc.value.code == "UNSUPPORTED_FPS"


def test_cost_formula_rounds_up():
    video = {"duration_seconds": 2.5, "width": 1280, "height": 720, "fps": 30.0}
    breakdown = estimate_job_cost(video, [{"type": "interpolate"}])
    assert breakdown["credits"] == 4
    assert breakdown["k_resolution"] == 0.75
    assert breakdown["k_fps"] == 1.0
    assert breakdown["k_operations"] == 1.0

    video = {"duration_seconds": 60, "width": 1920, "height": 1080, "fps": 59.94}
    breakdown = estimate_job_cost(
        video,
        [{"type": "upscale"}, {"type": "color_correct"}],
    )
    assert breakdown["fps"] == 59.94
    assert breakdown["k_fps"] == 1.5
    assert breakdown["k_operations"] == 2.0
    assert breakdown["credits"] == 300


def test_estimate_endpoint_includes_exports(client, monkeypatch, user):
    test_client, _ = client
    video_id = _upload(test_client, monkeypatch).json()["id"]
    profile_id = next(iter(EXPORT_PROFILES))

    response = test_client.post(
        "/api/v1/jobs/estimate",
        json={
            "video_id": video_id,
            "steps": [
                {"type": "upscale", "parameters": {"scale": 2}},
                {"type": "color_correct", "parameters": {"mode": "preset", "preset": "natural"}},
            ],
            "export_profile_ids": [profile_id, profile_id],
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["breakdown"]["credits"] == 200
    assert payload["export_cost_each"] == EXPORT_TOKEN_COST
    assert payload["export_credits"] == EXPORT_TOKEN_COST
    assert payload["total_credits"] == 200 + EXPORT_TOKEN_COST
    assert payload["token_balance"] == 300
    assert payload["affordable"] is True


def test_job_creation_charges_and_cancel_refunds(client, monkeypatch, user):
    from app import api

    test_client, sessions = client
    monkeypatch.setattr(api.process_job, "apply_async", lambda args: None)
    video_id = _upload(test_client, monkeypatch).json()["id"]
    payload = {
        "video_id": video_id,
        "steps": [{"type": "upscale", "parameters": {"scale": 2}}],
    }

    created = test_client.post("/api/v1/jobs", json=payload)
    assert created.status_code == 202
    assert created.json()["credits_cost"] == 150
    assert created.json()["credits_breakdown"]["k_operations"] == 1.5

    cancel = test_client.post(f"/api/v1/jobs/{created.json()['id']}/cancel")
    assert cancel.status_code == 200
    with sessions() as session:
        stored = session.get(Job, UUID(created.json()["id"]))
        assert stored.credits_refunded is True
        assert session.get(User, user.id).token_balance == 300


def test_job_creation_rejects_insufficient_tokens(client, monkeypatch, user):
    from app import api

    test_client, sessions = client
    monkeypatch.setattr(api.process_job, "apply_async", lambda args: None)
    video_id = _upload(test_client, monkeypatch).json()["id"]
    _set_balance(sessions, user.id, 50)

    response = test_client.post(
        "/api/v1/jobs",
        json={
            "video_id": video_id,
            "steps": [{"type": "interpolate", "parameters": {"target_fps": 60}}],
        },
    )
    assert response.status_code == 402
    assert response.json()["error"]["code"] == "INSUFFICIENT_TOKENS"
    assert response.json()["error"]["details"]["balance"] == 50
    with sessions() as session:
        assert session.get(User, user.id).token_balance == 50
        assert session.scalar(select(Job)) is None


def test_export_charge_is_refunded_with_queued_job(client, monkeypatch, user):
    from app import api

    test_client, sessions = client
    monkeypatch.setattr(api.process_job, "apply_async", lambda args: None)
    monkeypatch.setattr(api.process_export_job, "apply_async", lambda args: None)
    video_id = _upload(test_client, monkeypatch).json()["id"]
    job_id = test_client.post(
        "/api/v1/jobs",
        json={"video_id": video_id, "steps": [{"type": "color_correct", "parameters": {"mode": "preset", "preset": "natural"}}]},
    ).json()["id"]
    profile_id = next(iter(EXPORT_PROFILES))

    export = test_client.post(
        f"/api/v1/videos/{video_id}/exports",
        json={"profile_id": profile_id, "adaptation_mode": "crop", "job_id": job_id},
    )
    assert export.status_code == 202
    assert export.json()["credits_cost"] == EXPORT_TOKEN_COST

    test_client.post(f"/api/v1/jobs/{job_id}/cancel")
    with sessions() as session:
        assert session.get(User, user.id).token_balance == 300
        stored_export = session.get(ExportJob, UUID(export.json()["id"]))
        assert stored_export.credits_refunded is True


def test_refund_job_is_idempotent(client, user):
    _, sessions = client
    with sessions() as session:
        account = session.get(User, user.id)
        account.token_balance = 0
        video = Video(
            user_id=user.id,
            filename="source.mp4",
            content_type="video/mp4",
            size_bytes=1,
            storage_key="users/test/source.mp4",
        )
        session.add(video)
        session.flush()
        job = Job(
            user_id=user.id,
            video_id=video.id,
            status="failed",
            steps=[],
            credits_cost=50,
        )
        session.add(job)
        session.commit()
        assert refund_job(session, job) is True
        assert refund_job(session, job) is False
        assert account.token_balance == 50


def test_unsupported_upload_metadata_is_rejected(client, monkeypatch, user):
    test_client, _ = client
    high_fps = _upload(test_client, monkeypatch, fps=121.0)
    assert high_fps.status_code == 422
    assert high_fps.json()["error"]["code"] == "UNSUPPORTED_FPS"

    high_resolution = _upload(test_client, monkeypatch, width=4096, height=2160)
    assert high_resolution.status_code == 422
    assert high_resolution.json()["error"]["code"] == "UNSUPPORTED_RESOLUTION"
