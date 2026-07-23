from pathlib import Path

from fastapi.testclient import TestClient

from app.api.routes import uploads
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


def test_supabase_upload_keeps_provider_independent_url(monkeypatch) -> None:
    saved: dict[str, object] = {}

    async def fake_save(filename: str, data: bytes, media_type: str) -> None:
        saved.update(filename=filename, data=data, media_type=media_type)

    monkeypatch.setattr(settings, "storage_backend", "supabase")
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_secret_key", "sb_secret_server")
    monkeypatch.setattr(uploads, "save_image", fake_save)

    with TestClient(app) as client:
        register(client)
        response = client.post(
            "/api/v1/uploads/images",
            files={"file": ("scope.png", b"\x89PNG\r\n\x1a\nimage", "image/png")},
        )

    assert response.status_code == 201
    assert response.json()["url"].startswith("/uploads/")
    assert saved["media_type"] == "image/png"
    assert saved["data"] == b"\x89PNG\r\n\x1a\nimage"


def test_supabase_upload_url_redirects_to_public_bucket(monkeypatch) -> None:
    monkeypatch.setattr(settings, "storage_backend", "supabase")
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_secret_key", "sb_secret_server")
    monkeypatch.setattr(settings, "supabase_storage_bucket", "article-images")

    with TestClient(app, follow_redirects=False) as client:
        response = client.get("/uploads/example.png")

    assert response.status_code == 307
    assert response.headers["location"] == (
        "https://project.supabase.co/storage/v1/object/public/"
        "article-images/example.png"
    )
