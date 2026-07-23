from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


def test_frontend_routes_fall_back_to_built_index(tmp_path: Path, monkeypatch) -> None:
    (tmp_path / "index.html").write_text("<main>preview</main>", encoding="utf-8")
    monkeypatch.setattr(settings, "frontend_dist", str(tmp_path))

    with TestClient(app) as client:
        response = client.get("/articles/1")

    assert response.status_code == 200
    assert "preview" in response.text


def test_read_only_mode_blocks_writes_but_keeps_reads(monkeypatch) -> None:
    monkeypatch.setattr(settings, "maintenance_read_only", True)

    with TestClient(app) as client:
        read_response = client.get("/api/v1/health")
        write_response = client.post(
            "/api/v1/auth/register",
            json={"username": "maintenance_user", "password": "password123"},
        )

    assert read_response.status_code == 200
    assert write_response.status_code == 503
    assert write_response.json()["detail"] == "网站正在维护，暂时只能阅读"
