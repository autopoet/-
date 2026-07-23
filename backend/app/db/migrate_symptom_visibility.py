from peewee import BooleanField
from playhouse.migrate import SchemaMigrator, migrate

from app.db.database import database


def migrate_symptom_visibility() -> None:
    if "symptoms" not in database.get_tables():
        return

    columns = {column.name for column in database.get_columns("symptoms")}
    if "is_published" in columns:
        return

    migrator = SchemaMigrator.from_database(database)
    migrate(
        migrator.add_column(
            "symptoms",
            "is_published",
            BooleanField(default=True),
        )
    )


if __name__ == "__main__":
    with database.connection_context():
        migrate_symptom_visibility()
