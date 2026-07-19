from pydantic import BaseModel, ConfigDict, Field


class Credentials(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    username: str = Field(min_length=3, max_length=32, pattern=r"^[\w\u4e00-\u9fff-]+$")
    password: str = Field(min_length=8, max_length=128)


class UserItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str
