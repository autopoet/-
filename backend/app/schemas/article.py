from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ArticleDraftPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=2, max_length=100)
    summary: str = Field(min_length=5, max_length=500)
    applicability: str = Field(min_length=5, max_length=2000)
    safety: str = Field(default="", max_length=2000)
    checklist: list[str] = Field(min_length=1, max_length=20)
    body: str = Field(min_length=20, max_length=50_000)

    @field_validator("checklist")
    @classmethod
    def validate_checklist(cls, items: list[str]) -> list[str]:
        normalized = [item.strip() for item in items]
        if any(not item for item in normalized):
            raise ValueError("检查清单不能包含空项")
        if any(len(item) > 200 for item in normalized):
            raise ValueError("单条检查项不能超过 200 个字符")
        return normalized


class ReviewDecision(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    note: str = Field(default="", max_length=1000)


class ArticleRevisionItem(BaseModel):
    id: int
    symptom_id: int
    author_id: int
    author_name: str
    status: str
    title: str
    summary: str
    applicability: str
    safety: str
    checklist: list[str]
    body: str
    review_note: str
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None
    published_at: datetime | None


class RevisionListResponse(BaseModel):
    items: list[ArticleRevisionItem]
    total: int
