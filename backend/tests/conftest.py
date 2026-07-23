import os
from pathlib import Path

import pytest

os.environ["APP_DATABASE_URL"] = "sqlite:///data/test.db"

from app.db.database import database  # noqa: E402
from app.db.migrate_governance import ensure_governance_indexes  # noqa: E402
from app.models.article_revision import ArticleRevision  # noqa: E402
from app.models.comment import Comment, CommentThread  # noqa: E402
from app.models.favorite import Favorite  # noqa: E402
from app.models.feedback import ArticleFeedback  # noqa: E402
from app.models.governance import AuditLog, ReviewerApplication  # noqa: E402
from app.models.notification import Notification  # noqa: E402
from app.models.symptom import Symptom  # noqa: E402
from app.models.user import AuthSession, User  # noqa: E402

TEST_SYMPTOMS = (
    {"name": "无法上电", "description": "设备接通电源后没有任何响应"},
    {"name": "电压或电流异常", "description": "测量值明显高于或低于设计范围"},
    {
        "name": "通信失败或乱码",
        "description": "串口、I²C、SPI 等通信无法建立或数据错误",
    },
)

TABLES = [
    User,
    AuthSession,
    Symptom,
    ArticleRevision,
    Favorite,
    CommentThread,
    Comment,
    ReviewerApplication,
    AuditLog,
    ArticleFeedback,
    Notification,
]


@pytest.fixture(autouse=True)
def test_database():
    Path("data").mkdir(exist_ok=True)

    if not database.is_closed():
        database.close()

    database.connect()
    database.drop_tables(TABLES, safe=True)
    database.create_tables(TABLES)
    ensure_governance_indexes()
    Symptom.insert_many(TEST_SYMPTOMS).execute()
    database.close()

    yield

    if not database.is_closed():
        database.close()

    database.connect()
    database.drop_tables(TABLES, safe=True)
    database.close()
