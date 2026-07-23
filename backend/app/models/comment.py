from datetime import datetime

from peewee import (
    BooleanField,
    CharField,
    DateTimeField,
    ForeignKeyField,
    IntegerField,
    TextField,
)

from app.models.article_revision import ArticleRevision
from app.models.base import BaseModel
from app.models.symptom import Symptom
from app.models.user import User


class CommentThread(BaseModel):
    symptom = ForeignKeyField(Symptom, backref="comment_threads", on_delete="CASCADE")
    revision = ForeignKeyField(
        ArticleRevision,
        backref="anchored_comment_threads",
        on_delete="CASCADE",
    )
    current_revision = ForeignKeyField(
        ArticleRevision,
        backref="current_comment_threads",
        null=True,
        on_delete="SET NULL",
    )
    author = ForeignKeyField(User, backref="comment_threads", on_delete="CASCADE")
    resolved_by = ForeignKeyField(
        User,
        backref="resolved_comment_threads",
        null=True,
        on_delete="SET NULL",
    )
    quote = TextField()
    prefix = TextField(default="")
    suffix = TextField(default="")
    block_id = CharField(max_length=100, null=True)
    start_offset = IntegerField()
    end_offset = IntegerField()
    current_start_offset = IntegerField(null=True)
    current_end_offset = IntegerField(null=True)
    is_detached = BooleanField(default=False, index=True)
    status = CharField(max_length=16, default="open", index=True)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)
    resolved_at = DateTimeField(null=True)

    class Meta:
        table_name = "comment_threads"


class Comment(BaseModel):
    thread = ForeignKeyField(CommentThread, backref="comments", on_delete="CASCADE")
    author = ForeignKeyField(User, backref="comments", on_delete="CASCADE")
    body = TextField()
    created_at = DateTimeField(default=datetime.now)

    class Meta:
        table_name = "comments"
