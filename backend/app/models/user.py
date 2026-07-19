from datetime import datetime

from peewee import CharField, DateTimeField, ForeignKeyField, TextField

from app.models.base import BaseModel


class User(BaseModel):
    username = CharField(max_length=32, unique=True, index=True)
    password_hash = TextField()
    role = CharField(max_length=16, default="contributor")
    created_at = DateTimeField(default=datetime.now)

    class Meta:
        table_name = "users"


class AuthSession(BaseModel):
    user = ForeignKeyField(User, backref="sessions", on_delete="CASCADE")
    token_hash = CharField(max_length=64, unique=True, index=True)
    expires_at = DateTimeField()
    created_at = DateTimeField(default=datetime.now)

    class Meta:
        table_name = "auth_sessions"
