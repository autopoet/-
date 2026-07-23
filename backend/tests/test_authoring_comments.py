import json

from fastapi.testclient import TestClient

from app.api.routes.comments import extract_plain_text
from app.main import app

ARTICLE_CREATE = {
    "name": "负载后电压骤降",
    "description": "稳压输出接入负载后明显下降",
}
FIRST_BODY = json.dumps(
    {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "电源指示灯没有亮起。"}],
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "先测量输入端电压。"}],
            },
        ],
    },
    ensure_ascii=False,
)


def register(client: TestClient, username: str) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "password123"},
    )
    assert response.status_code == 201
    return response.json()


def login(client: TestClient, username: str) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "password123"},
    )
    assert response.status_code == 200


def save_payload(body: str, edit_summary: str) -> dict:
    return {
        "title": "负载后电压骤降",
        "summary": "稳压输出接入负载后明显下降",
        "applicability": "适用于常见低压直流稳压电源。",
        "safety": "重新接线前必须断电。",
        "checklist": ["确认输入电压", "测量带载输出"],
        "body": body,
        "edit_summary": edit_summary,
    }


def test_extract_plain_text_includes_inline_formula() -> None:
    body = json.dumps(
        {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "压差为 "},
                        {"type": "inlineFormula", "attrs": {"formula": "V_{in}-V_{out}"}},
                    ],
                }
            ],
        }
    )
    assert extract_plain_text(body) == "压差为 V_{in}-V_{out}\n"


def publish_first_revision(client: TestClient) -> tuple[int, int]:
    register(client, "reviewer")
    client.post("/api/v1/auth/logout")
    register(client, "author")
    created = client.post("/api/v1/articles", json=ARTICLE_CREATE).json()
    symptom_id = created["symptom"]["id"]
    saved = client.put(
        f"/api/v1/articles/{symptom_id}/draft",
        json=save_payload(FIRST_BODY, "补充首版排查文档"),
    ).json()
    client.post(f"/api/v1/articles/{symptom_id}/submit")
    client.post("/api/v1/auth/logout")
    login(client, "reviewer")
    approved = client.post(
        f"/api/v1/reviews/{saved['id']}/approve",
        json={"note": "可以发布"},
    )
    assert approved.status_code == 200
    client.post("/api/v1/auth/logout")
    login(client, "author")
    return symptom_id, approved.json()["id"]


def test_new_article_stays_private_until_review() -> None:
    with TestClient(app) as client:
        anonymous = client.post("/api/v1/articles", json=ARTICLE_CREATE)
        assert anonymous.status_code == 401

        register(client, "reviewer")
        client.post("/api/v1/auth/logout")
        register(client, "author")
        created = client.post("/api/v1/articles", json=ARTICLE_CREATE)

        assert created.status_code == 201
        result = created.json()
        symptom_id = result["symptom"]["id"]
        assert result["symptom"] == {"id": symptom_id, **ARTICLE_CREATE}
        assert result["draft"]["status"] == "draft"
        assert result["draft"]["symptom_id"] == symptom_id
        assert json.loads(result["draft"]["body"]) == {
            "type": "doc",
            "content": [],
        }
        assert client.get(f"/api/v1/symptoms/{symptom_id}").status_code == 200
        assert client.get("/api/v1/symptoms").json()["total"] == 3
        assert client.get(f"/api/v1/articles/{symptom_id}").status_code == 404
        assert client.get(f"/api/v1/articles/{symptom_id}/revisions").status_code == 404

        duplicate = client.post("/api/v1/articles", json=ARTICLE_CREATE)
        assert duplicate.status_code == 409

        saved = client.put(
            f"/api/v1/articles/{symptom_id}/draft",
            json=save_payload(FIRST_BODY, "补充首版排查文档"),
        )
        assert saved.status_code == 200
        submitted = client.post(f"/api/v1/articles/{symptom_id}/submit")
        assert submitted.status_code == 200
        assert client.get(f"/api/v1/articles/{symptom_id}/draft").json()["status"] == "pending"
        assert (
            client.put(
                f"/api/v1/articles/{symptom_id}/draft",
                json=save_payload(FIRST_BODY, "审核期间不应创建另一份草稿"),
            ).status_code
            == 409
        )

        client.post("/api/v1/auth/logout")
        assert client.get(f"/api/v1/symptoms/{symptom_id}").status_code == 404

        login(client, "reviewer")
        approved = client.post(
            f"/api/v1/reviews/{submitted.json()['id']}/approve",
            json={"note": "可以发布"},
        )
        assert approved.status_code == 200
        client.post("/api/v1/auth/logout")

        assert client.get(f"/api/v1/symptoms/{symptom_id}").status_code == 200
        assert client.get("/api/v1/symptoms").json()["total"] == 4
        assert client.get(f"/api/v1/articles/{symptom_id}").status_code == 200


def test_unpublished_article_only_allows_original_author_to_edit() -> None:
    with TestClient(app) as client:
        register(client, "original_author")
        created = client.post("/api/v1/articles", json=ARTICLE_CREATE)
        assert created.status_code == 201
        symptom_id = created.json()["symptom"]["id"]

        client.post("/api/v1/auth/logout")
        register(client, "other_contributor")
        assert client.get(f"/api/v1/articles/{symptom_id}/draft").status_code == 404
        assert (
            client.put(
                f"/api/v1/articles/{symptom_id}/draft",
                json=save_payload(FIRST_BODY, "尝试修改他人的未发布条目"),
            ).status_code
            == 404
        )
        assert client.get("/api/v1/articles/mine").json()["total"] == 0

        client.post("/api/v1/auth/logout")
        login(client, "original_author")
        saved = client.put(
            f"/api/v1/articles/{symptom_id}/draft",
            json=save_payload(FIRST_BODY, "原作者继续完善首版文档"),
        )
        assert saved.status_code == 200


def test_comment_thread_reply_and_status_permissions() -> None:
    with TestClient(app) as client:
        symptom_id, revision_id = publish_first_revision(client)
        quote = "电源指示灯没有亮起"
        created = client.post(
            f"/api/v1/articles/{symptom_id}/comments",
            json={
                "revision_id": revision_id,
                "quote": quote,
                "start_offset": 2,
                "end_offset": 3,
                "suffix": "。",
                "body": "这里是否也要检查限流设置？",
            },
        )
        assert created.status_code == 201
        thread = created.json()
        assert thread["start_offset"] == 0
        assert thread["end_offset"] == len(quote)
        assert thread["is_detached"] is False
        assert thread["comments"][0]["author_name"] == "author"

        client.post("/api/v1/auth/logout")
        public_threads = client.get(f"/api/v1/articles/{symptom_id}/comments")
        assert public_threads.status_code == 200
        assert public_threads.json()["total"] == 1
        anonymous_create = client.post(
            f"/api/v1/articles/{symptom_id}/comments",
            json={
                "revision_id": revision_id,
                "quote": quote,
                "start_offset": 0,
                "end_offset": len(quote),
                "body": "匿名评论",
            },
        )
        assert anonymous_create.status_code == 401

        register(client, "reader")
        replied = client.post(
            f"/api/v1/comments/{thread['id']}/replies",
            json={"body": "建议同时记录输入电流。"},
        )
        assert replied.status_code == 201
        assert len(replied.json()["comments"]) == 2
        forbidden = client.post(f"/api/v1/comments/{thread['id']}/resolve")
        assert forbidden.status_code == 403

        client.post("/api/v1/auth/logout")
        login(client, "author")
        resolved = client.post(f"/api/v1/comments/{thread['id']}/resolve")
        assert resolved.status_code == 200
        assert resolved.json()["status"] == "resolved"
        assert resolved.json()["resolved_by_name"] == "author"
        assert (
            client.post(
                f"/api/v1/comments/{thread['id']}/replies",
                json={"body": "解决后回复"},
            ).status_code
            == 409
        )

        client.post("/api/v1/auth/logout")
        login(client, "reviewer")
        reopened = client.post(f"/api/v1/comments/{thread['id']}/reopen")
        assert reopened.status_code == 200
        assert reopened.json()["status"] == "open"
        assert reopened.json()["resolved_by_id"] is None


def test_comment_anchor_relocates_and_can_become_detached() -> None:
    with TestClient(app) as client:
        symptom_id, revision_id = publish_first_revision(client)
        quote = "电源指示灯没有亮起"
        thread = client.post(
            f"/api/v1/articles/{symptom_id}/comments",
            json={
                "revision_id": revision_id,
                "quote": quote,
                "start_offset": 0,
                "end_offset": len(quote),
                "suffix": "。",
                "body": "请确认这一步。",
            },
        ).json()

        moved_body = json.dumps(
            {
                "type": "doc",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": "先确认保险丝。"}],
                    },
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": "电源指示灯没有亮起。"}],
                    },
                ],
            },
            ensure_ascii=False,
        )
        second = client.put(
            f"/api/v1/articles/{symptom_id}/draft",
            json=save_payload(moved_body, "调整检查顺序"),
        ).json()
        client.post(f"/api/v1/articles/{symptom_id}/submit")
        client.post("/api/v1/auth/logout")
        login(client, "reviewer")
        client.post(
            f"/api/v1/reviews/{second['id']}/approve",
            json={"note": "同意"},
        )
        relocated = client.get(f"/api/v1/articles/{symptom_id}/comments").json()["items"][0]
        assert relocated["id"] == thread["id"]
        assert relocated["current_revision_id"] == second["id"]
        assert relocated["current_start_offset"] > 0
        assert relocated["is_detached"] is False

        client.post("/api/v1/auth/logout")
        login(client, "author")
        removed_body = json.dumps(
            {
                "type": "doc",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": "先确认保险丝和输入电流。"}],
                    }
                ],
            },
            ensure_ascii=False,
        )
        third = client.put(
            f"/api/v1/articles/{symptom_id}/draft",
            json=save_payload(removed_body, "删除过时描述"),
        ).json()
        client.post(f"/api/v1/articles/{symptom_id}/submit")
        client.post("/api/v1/auth/logout")
        login(client, "reviewer")
        client.post(
            f"/api/v1/reviews/{third['id']}/approve",
            json={"note": "同意"},
        )
        detached = client.get(f"/api/v1/articles/{symptom_id}/comments").json()["items"][0]
        assert detached["current_revision_id"] == third["id"]
        assert detached["current_start_offset"] is None
        assert detached["current_end_offset"] is None
        assert detached["is_detached"] is True


def test_comment_must_target_current_approved_revision() -> None:
    with TestClient(app) as client:
        symptom_id, first_revision_id = publish_first_revision(client)
        second = client.put(
            f"/api/v1/articles/{symptom_id}/draft",
            json=save_payload(FIRST_BODY, "发布第二版用于评论定位"),
        ).json()
        assert client.post(f"/api/v1/articles/{symptom_id}/submit").status_code == 200

        client.post("/api/v1/auth/logout")
        login(client, "reviewer")
        approved = client.post(
            f"/api/v1/reviews/{second['id']}/approve",
            json={"note": "同意发布第二版"},
        )
        assert approved.status_code == 200

        quote = "电源指示灯没有亮起"
        comment = {
            "quote": quote,
            "start_offset": 0,
            "end_offset": len(quote),
            "body": "确认评论只落在当前公开版本",
        }
        stale = client.post(
            f"/api/v1/articles/{symptom_id}/comments",
            json={**comment, "revision_id": first_revision_id},
        )
        assert stale.status_code == 409

        current = client.post(
            f"/api/v1/articles/{symptom_id}/comments",
            json={**comment, "revision_id": second["id"]},
        )
        assert current.status_code == 201
        assert current.json()["revision_id"] == second["id"]
