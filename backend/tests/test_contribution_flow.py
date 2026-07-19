from fastapi.testclient import TestClient

from app.main import app

DRAFT = {
    "title": "无法上电",
    "summary": "设备接通电源后没有任何响应",
    "applicability": "适用于低压直流供电的单片机最小系统。",
    "safety": "测量电阻或重新焊接前必须断电。",
    "checklist": ["确认电源电压", "确认供电极性"],
    "body": "## 现象描述\n\n接通电源后指示灯和串口均无响应。\n\n## 排查步骤\n\n先测量输入端电压。",
    "edit_summary": "补充无法上电的基础排查步骤",
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
        queue_item = queue.json()["items"][0]
        revision_id = queue_item["revision"]["id"]
        assert queue_item["base_revision"] is None

        approved = client.post(
            f"/api/v1/reviews/{revision_id}/approve",
            json={"note": "结构清楚，可以发布"},
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "approved"
        assert approved.json()["reviewer_name"] == "owner"
        assert approved.json()["reviewed_at"] is not None
        assert approved.json()["version_number"] == 1

        published = client.get("/api/v1/articles/1")
        assert published.status_code == 200
        assert published.json()["body"] == DRAFT["body"]


def test_rejected_revision_can_be_edited_again() -> None:
    with TestClient(app) as client:
        register(client, "owner")
        client.post("/api/v1/auth/logout")
        register(client, "student")
        client.put("/api/v1/articles/1/draft", json=DRAFT)
        submitted = client.post("/api/v1/articles/1/submit").json()
        client.post("/api/v1/auth/logout")
        client.post(
            "/api/v1/auth/login",
            json={"username": "owner", "password": "password123"},
        )
        rejected = client.post(
            f"/api/v1/reviews/{submitted['id']}/reject",
            json={"note": "需要补充测量条件"},
        )
        assert rejected.status_code == 200
        assert rejected.json()["status"] == "rejected"
        assert rejected.json()["reviewer_name"] == "owner"

        client.post("/api/v1/auth/logout")
        client.post(
            "/api/v1/auth/login",
            json={"username": "student", "password": "password123"},
        )
        edited = client.put(
            "/api/v1/articles/1/draft",
            json={**DRAFT, "summary": "补充测量条件后的设备无响应现象"},
        )
        assert edited.status_code == 200
        assert edited.json()["status"] == "draft"
        assert edited.json()["id"] != rejected.json()["id"]
        assert edited.json()["version_number"] == 2
        assert edited.json()["review_note"] == ""


def test_reviewer_cannot_review_own_revision() -> None:
    with TestClient(app) as client:
        register(client, "owner")
        client.put("/api/v1/articles/1/draft", json=DRAFT)
        submitted = client.post("/api/v1/articles/1/submit").json()

        response = client.post(
            f"/api/v1/reviews/{submitted['id']}/approve",
            json={"note": ""},
        )

    assert response.status_code == 403
    assert response.json()["detail"] == "审核员不能审核自己提交的版本"


def test_second_version_keeps_base_and_review_metadata() -> None:
    with TestClient(app) as client:
        register(client, "owner")
        client.post("/api/v1/auth/logout")
        register(client, "student")
        first = client.put("/api/v1/articles/1/draft", json=DRAFT).json()
        client.post("/api/v1/articles/1/submit")

        client.post("/api/v1/auth/logout")
        client.post(
            "/api/v1/auth/login",
            json={"username": "owner", "password": "password123"},
        )
        client.post(
            f"/api/v1/reviews/{first['id']}/approve",
            json={"note": ""},
        )

        client.post("/api/v1/auth/logout")
        client.post(
            "/api/v1/auth/login",
            json={"username": "student", "password": "password123"},
        )
        second = client.put(
            "/api/v1/articles/1/draft",
            json={
                **DRAFT,
                "summary": "第二版补充测量条件",
                "edit_summary": "补充测量条件",
            },
        ).json()
        client.post("/api/v1/articles/1/submit")

        client.post("/api/v1/auth/logout")
        client.post(
            "/api/v1/auth/login",
            json={"username": "owner", "password": "password123"},
        )
        queue = client.get("/api/v1/reviews").json()
        comparison = queue["items"][0]

    assert second["version_number"] == 2
    assert second["base_revision_id"] == first["id"]
    assert comparison["revision"]["id"] == second["id"]
    assert comparison["base_revision"]["id"] == first["id"]
