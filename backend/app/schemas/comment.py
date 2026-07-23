from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class CommentThreadCreate(BaseModel):
    revision_id: int = Field(gt=0)
    quote: str = Field(min_length=1, max_length=2000)
    start_offset: int = Field(ge=0)
    end_offset: int = Field(gt=0)
    prefix: str = Field(default="", max_length=300)
    suffix: str = Field(default="", max_length=300)
    block_id: str | None = Field(default=None, max_length=100)
    body: str = Field(min_length=1, max_length=5000)

    @field_validator("body")
    @classmethod
    def strip_body(cls, body: str) -> str:
        body = body.strip()
        if not body:
            raise ValueError("评论内容不能为空")
        return body

    @model_validator(mode="after")
    def validate_offsets(self) -> "CommentThreadCreate":
        if self.end_offset <= self.start_offset:
            raise ValueError("结束位置必须大于开始位置")
        return self


class CommentReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)

    @field_validator("body")
    @classmethod
    def strip_body(cls, body: str) -> str:
        body = body.strip()
        if not body:
            raise ValueError("回复内容不能为空")
        return body


class CommentItem(BaseModel):
    id: int
    author_id: int
    author_name: str
    body: str
    created_at: datetime


class CommentThreadItem(BaseModel):
    id: int
    symptom_id: int
    revision_id: int
    current_revision_id: int | None
    author_id: int
    author_name: str
    resolved_by_id: int | None
    resolved_by_name: str | None
    quote: str
    prefix: str
    suffix: str
    block_id: str | None
    start_offset: int
    end_offset: int
    current_start_offset: int | None
    current_end_offset: int | None
    is_detached: bool
    status: Literal["open", "resolved"]
    comments: list[CommentItem]
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None


class CommentThreadListResponse(BaseModel):
    items: list[CommentThreadItem]
    total: int
