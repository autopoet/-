from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


def register(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"username": "image_author", "password": "password123"},
    )
    assert response.status_code == 201


def test_image_upload_requires_login(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/uploads/images",
            files={"file": ("scope.png", b"\x89PNG\r\n\x1a\nimage", "image/png")},
        )

    assert response.status_code == 401


def test_image_upload_validates_and_saves_file(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    with TestClient(app) as client:
        register(client)
        response = client.post(
            "/api/v1/uploads/images",
            files={"file": ("scope.png", b"\x89PNG\r\n\x1a\nimage", "image/png")},
        )

    assert response.status_code == 201
    payload = response.json()
    assert payload["media_type"] == "image/png"
    assert payload["url"].startswith("/uploads/")
    assert (tmp_path / payload["url"].removeprefix("/uploads/")).exists()


def test_image_upload_rejects_unknown_content(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    with TestClient(app) as client:
        register(client)
        response = client.post(
            "/api/v1/uploads/images",
            files={"file": ("fake.png", b"not-an-image", "image/png")},
        )

    assert response.status_code == 415
