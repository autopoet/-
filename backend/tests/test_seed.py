import json

from app.core.security import hash_password
from app.db.seed import GUIDE_EDIT_SUMMARY, GUIDE_SYMPTOM, seed_site_guide
from app.models.article_revision import ArticleRevision
from app.models.symptom import Symptom
from app.models.user import User


def test_seed_is_idempotent_and_publishes_site_guide() -> None:
    for _ in range(2):
        seed_site_guide(
            reviewer_username="seed_reviewer",
            reviewer_password="reviewer-password",
            contributor_username="seed_contributor",
            contributor_password="contributor-password",
        )

    revision = ArticleRevision.get(ArticleRevision.edit_summary == GUIDE_EDIT_SUMMARY)
    body = json.loads(revision.body)

    demo_users = User.select().where(User.username.in_(("seed_reviewer", "seed_contributor")))
    demo_revisions = ArticleRevision.select().where(
        ArticleRevision.edit_summary == GUIDE_EDIT_SUMMARY
    )

    assert demo_users.count() == 2
    assert Symptom.select().where(Symptom.name == GUIDE_SYMPTOM["name"]).count() == 1
    assert demo_revisions.count() == 1
    assert revision.status == "approved"
    assert revision.origin == "official_seed"
    assert revision.symptom.is_published is True
    assert revision.version_number == 1
    assert revision.title == "本站使用指南"
    assert revision.author.username == "seed_reviewer"
    assert revision.reviewer.username == "seed_reviewer"
    assert revision.submitted_at is not None
    assert revision.reviewed_at is not None
    assert revision.published_at is not None
    assert body["type"] == "doc"
    assert {node["type"] for node in body["content"]} >= {
        "heading",
        "paragraph",
        "bulletList",
        "orderedList",
        "codeBlock",
        "blockquote",
    }


def test_site_guide_uses_existing_admin_as_owner() -> None:
    admin = User.create(
        username="existing_admin",
        password_hash=hash_password("admin-password"),
        role="admin",
    )

    revision = seed_site_guide(
        reviewer_username="seed_reviewer",
        reviewer_password="reviewer-password",
        contributor_username="seed_contributor",
        contributor_password="contributor-password",
    )

    assert revision.author_id == admin.id
    assert revision.reviewer_id == admin.id
    assert User.get(User.username == "seed_reviewer").role == "reviewer"
