from fastapi.testclient import TestClient

from app.main import app


def test_list_symptoms() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/symptoms")

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 3
    assert len(data["items"]) == 3
    assert data["items"][0] == {
        "id": 1,
        "name": "无法上电",
        "description": "设备接通电源后没有任何响应",
    }


def test_get_symptom() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/symptoms/1")

    assert response.status_code == 200
    assert response.json()["name"] == "无法上电"


def test_get_missing_symptom() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/symptoms/999")

    assert response.status_code == 404
    assert response.json() == {
        "detail": "故障现象不存在",
    }


def test_reject_invalid_symptom_id() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/symptoms/abc")

    assert response.status_code == 422


def test_filter_symptoms_by_keyword() -> None:
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/symptoms",
            params={"keyword": "通信"},
        )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 1
    assert data["items"][0]["id"] == 3


def test_reject_too_short_keyword() -> None:
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/symptoms",
            params={"keyword": "电"},
        )

    assert response.status_code == 422


def test_anonymous_symptom_creation_is_not_available() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/symptoms",
            json={
                "name": "输出波形失真",
                "description": "示波器观察到输出波形削顶或产生明显畸变",
            },
        )

    assert response.status_code == 405
