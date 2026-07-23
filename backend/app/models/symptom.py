from peewee import BooleanField, CharField, TextField

from app.models.base import BaseModel


class Symptom(BaseModel):
    name = CharField(max_length=100, unique=True, index=True)
    description = TextField()
    is_published = BooleanField(default=True)

    class Meta:
        table_name = "symptoms"
