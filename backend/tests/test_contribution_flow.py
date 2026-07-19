from fastapi.testclient import TestClient

from app.main import app

DRAFT = {
    "title": "无法上电",
    "summary": "设备接通电源后没有任何响应",
    "applicability": "适用于低压直流供电的单片机最小系统。",
    "safety": "测量电阻或重新焊接前必须断电。",
    "checklist": ["确认电源电压", "确认供电极性"],
    "body": "## 现象描述\n\n接通电源后指示灯和串口均无响应。\n\n## 排查步骤\n\n先测量输入端电压。",
}


def register(client: TestClient, username: str) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "password123"},
    )
    assert response.status_code == 201
    return response.json()


def test_first_user_is_reviewer() -> None:
    with TestClient(app) as client:
        user = register(client, "reviewer")
        me = client.get("/api/v1/auth/me")

    assert user["role"] == "reviewer"
    assert me.status_code == 200
    assert me.json()["username"] == "reviewer"


def test_login_rejects_wrong_password() -> None:
    with TestClient(app) as client:
        register(client, "reviewer")
        client.post("/api/v1/auth/logout")
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "reviewer", "password": "wrong-pass"},
        )

    assert response.status_code == 401


def test_register_edit_submit_review_publish_flow() -> None:
    with TestClient(app) as client:
        reviewer = register(client, "owner")
        assert reviewer["role"] == "reviewer"
        client.post("/api/v1/auth/logout")

        contributor = register(client, "student")
        assert contributor["role"] == "contributor"

        saved = client.put("/api/v1/articles/1/draft", json=DRAFT)
        assert saved.status_code == 200
        assert saved.json()["status"] == "draft"

        submitted = client.post("/api/v1/articles/1/submit")
        assert submitted.status_code == 200
        assert submitted.json()["status"] == "pending"

        forbidden = client.get("/api/v1/reviews")
        assert forbidden.status_code == 403

        client.post("/api/v1/auth/logout")
        login = client.post(
            "/api/v1/auth/login",
            json={"username": "owner", "password": "password123"},
        )
        assert login.status_code == 200

        queue = client.get("/api/v1/reviews")
        assert queue.status_code == 200
        assert queue.json()["total"] == 1
        revision_id = queue.json()["items"][0]["id"]

        approved = client.post(
            f"/api/v1/reviews/{revision_id}/approve",
            json={"note": "结构清楚，可以发布"},
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "approved"

        published = client.get("/api/v1/articles/1")
        assert published.status_code == 200
        assert published.json()["body"] == DRAFT["body"]


def test_rejected_revision_can_be_edited_again() -> None:
    with TestClient(app) as client:
        register(client, "owner")
        client.put("/api/v1/articles/1/draft", json=DRAFT)
        submitted = client.post("/api/v1/articles/1/submit").json()
        rejected = client.post(
            f"/api/v1/reviews/{submitted['id']}/reject",
            json={"note": "需要补充测量条件"},
        )
        assert rejected.status_code == 200
        assert rejected.json()["status"] == "rejected"

        edited = client.put(
            "/api/v1/articles/1/draft",
            json={**DRAFT, "summary": "补充测量条件后的设备无响应现象"},
        )
        assert edited.status_code == 200
        assert edited.json()["status"] == "draft"
        assert edited.json()["review_note"] == ""
