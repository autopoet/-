from datetime import datetime

from peewee import DateTimeField, ForeignKeyField

from app.models.base import BaseModel
from app.models.symptom import Symptom
from app.models.user import User


class Favorite(BaseModel):
    user = ForeignKeyField(User, backref="favorites", on_delete="CASCADE")
    symptom = ForeignKeyField(
        Symptom,
        backref="favorites",
        on_delete="CASCADE",
    )
    created_at = DateTimeField(default=datetime.now)

    class Meta:
        table_name = "favorites"
        indexes = ((("user", "symptom"), True),)
