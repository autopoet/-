from peewee import DateTimeField, IntegerField, TextField
from playhouse.migrate import SchemaMigrator, migrate

from app.db.database import database


def migrate_revision_metadata() -> None:
    if "article_revisions" not in database.get_tables():
        return

    columns = {
        column.name for column in database.get_columns("article_revisions")
    }
    migrator = SchemaMigrator.from_database(database)
    operations = []

    if "reviewer_id" not in columns:
        operations.append(
            migrator.add_column(
                "article_revisions",
                "reviewer_id",
                IntegerField(null=True),
            )
        )
    if "base_revision_id" not in columns:
        operations.append(
            migrator.add_column(
                "article_revisions",
                "base_revision_id",
                IntegerField(null=True),
            )
        )
    if "version_number" not in columns:
        operations.append(
            migrator.add_column(
                "article_revisions",
                "version_number",
                IntegerField(default=1),
            )
        )
    if "edit_summary" not in columns:
        operations.append(
            migrator.add_column(
                "article_revisions",
                "edit_summary",
                TextField(default=""),
            )
        )
    if "reviewed_at" not in columns:
        operations.append(
            migrator.add_column(
                "article_revisions",
                "reviewed_at",
                DateTimeField(null=True),
            )
        )

    if operations:
        migrate(*operations)


if __name__ == "__main__":
    with database.connection_context():
        migrate_revision_metadata()
