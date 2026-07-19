from pathlib import Path

from app.core.config import settings
from app.db.database import database
from app.db.seed import DEFAULT_SYMPTOMS
from app.models.article_revision import ArticleRevision
from app.models.symptom import Symptom
from app.models.user import AuthSession, User


def bootstrap_database() -> None:
    if settings.database_url.startswith("sqlite"):
        Path("data").mkdir(exist_ok=True)

    with database:
        database.create_tables([User, AuthSession, Symptom, ArticleRevision], safe=True)
        (
            Symptom.insert_many(DEFAULT_SYMPTOMS)
            .on_conflict_ignore()
            .execute()
        )


if __name__ == "__main__":
    bootstrap_database()
