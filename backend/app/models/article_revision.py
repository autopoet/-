from datetime import datetime

from peewee import CharField, DateTimeField, ForeignKeyField, IntegerField, TextField

from app.models.base import BaseModel
from app.models.symptom import Symptom
from app.models.user import User


class ArticleRevision(BaseModel):
    symptom = ForeignKeyField(Symptom, backref="revisions", on_delete="CASCADE")
    author = ForeignKeyField(User, backref="revisions", on_delete="CASCADE")
    reviewer = ForeignKeyField(
        User,
        backref="reviewed_revisions",
        null=True,
        on_delete="SET NULL",
    )
    base_revision = ForeignKeyField(
        "self",
        backref="derived_revisions",
        null=True,
        on_delete="SET NULL",
    )
    version_number = IntegerField(default=1)
    status = CharField(max_length=16, default="draft", index=True)
    title = CharField(max_length=100)
    summary = TextField()
    applicability = TextField()
    safety = TextField(default="")
    checklist_json = TextField(default="[]")
    body = TextField()
    edit_summary = TextField(default="")
    review_note = TextField(default="")
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)
    submitted_at = DateTimeField(null=True)
    reviewed_at = DateTimeField(null=True)
    published_at = DateTimeField(null=True)

    class Meta:
        table_name = "article_revisions"
