from pathlib import Path

from app.core.config import settings
from app.db.database import database
from app.db.migrate_governance import (
    ensure_governance_indexes,
    ensure_single_admin,
    migrate_revision_governance,
)
from app.db.migrate_revision_metadata import migrate_revision_metadata
from app.db.migrate_symptom_visibility import migrate_symptom_visibility
from app.models.article_revision import ArticleRevision
from app.models.comment import Comment, CommentThread
from app.models.favorite import Favorite
from app.models.feedback import ArticleFeedback
from app.models.governance import AuditLog, ReviewerApplication
from app.models.notification import Notification
from app.models.symptom import Symptom
from app.models.user import AuthSession, User


def bootstrap_database() -> None:
    if settings.database_url.startswith("sqlite"):
        Path("data").mkdir(exist_ok=True)

    with database:
        database.create_tables([User, AuthSession, Symptom], safe=True)
        migrate_symptom_visibility()
        if ArticleRevision.table_exists():
            migrate_revision_metadata()
            migrate_revision_governance()
        else:
            database.create_tables([ArticleRevision])
        ensure_single_admin()
        ensure_governance_indexes()
        database.create_tables([Favorite], safe=True)
        database.create_tables([CommentThread, Comment], safe=True)
        database.create_tables(
            [ReviewerApplication, AuditLog, ArticleFeedback, Notification],
            safe=True,
        )


if __name__ == "__main__":
    bootstrap_database()
