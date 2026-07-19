import os
from pathlib import Path

import pytest

os.environ["APP_DATABASE_URL"] = "sqlite:///data/test.db"

from app.db.database import database  # noqa: E402
from app.db.seed import DEFAULT_SYMPTOMS  # noqa: E402
from app.models.symptom import Symptom  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def test_database():
    Path("data").mkdir(exist_ok=True)

    if not database.is_closed():
        database.close()

    database.connect()
    database.drop_tables([Symptom], safe=True)
    database.create_tables([Symptom])
    Symptom.insert_many(DEFAULT_SYMPTOMS).execute()
    database.close()

    yield

    database.connect()
    database.drop_tables([Symptom], safe=True)
    database.close()

