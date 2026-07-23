import json

from app.db.seed import DEMO_EDIT_SUMMARY, DEMO_SYMPTOM, seed_demo_data
from app.models.article_revision import ArticleRevision
from app.models.symptom import Symptom
from app.models.user import User


def test_demo_seed_is_idempotent_and_publishes_structured_article() -> None:
    for _ in range(2):
        seed_demo_data(
            reviewer_username="seed_reviewer",
            reviewer_password="reviewer-password",
            contributor_username="seed_contributor",
            contributor_password="contributor-password",
        )

    revision = ArticleRevision.get(ArticleRevision.edit_summary == DEMO_EDIT_SUMMARY)
    body = json.loads(revision.body)

    demo_users = User.select().where(User.username.in_(("seed_reviewer", "seed_contributor")))
    demo_revisions = ArticleRevision.select().where(
        ArticleRevision.edit_summary == DEMO_EDIT_SUMMARY
    )

    assert demo_users.count() == 2
    assert Symptom.select().where(Symptom.name == DEMO_SYMPTOM["name"]).count() == 1
    assert demo_revisions.count() == 1
    assert revision.status == "approved"
    assert revision.symptom.is_published is True
    assert revision.version_number == 1
    assert revision.author.username == "seed_contributor"
    assert revision.reviewer.username == "seed_reviewer"
    assert revision.submitted_at is not None
    assert revision.reviewed_at is not None
    assert revision.published_at is not None
    assert body["type"] == "doc"
    assert {node["type"] for node in body["content"]} >= {
        "heading",
        "paragraph",
        "bulletList",
        "codeBlock",
        "blockquote",
    }
