import os
from pathlib import Path

import pytest

os.environ["APP_DATABASE_URL"] = "sqlite:///data/test.db"

from app.db.database import database  # noqa: E402
from app.db.seed import DEFAULT_SYMPTOMS  # noqa: E402
from app.models.article_revision import ArticleRevision  # noqa: E402
from app.models.comment import Comment, CommentThread  # noqa: E402
from app.models.favorite import Favorite  # noqa: E402
from app.models.symptom import Symptom  # noqa: E402
from app.models.user import AuthSession, User  # noqa: E402

TABLES = [
    User,
    AuthSession,
    Symptom,
    ArticleRevision,
    Favorite,
    CommentThread,
    Comment,
]


@pytest.fixture(autouse=True)
def test_database():
    Path("data").mkdir(exist_ok=True)

    if not database.is_closed():
        database.close()

    database.connect()
    database.drop_tables(TABLES, safe=True)
    database.create_tables(TABLES)
    Symptom.insert_many(DEFAULT_SYMPTOMS).execute()
    database.close()

    yield

    if not database.is_closed():
        database.close()

    database.connect()
    database.drop_tables(TABLES, safe=True)
    database.close()
