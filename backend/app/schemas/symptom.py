from pydantic import BaseModel


class SymptomItem(BaseModel):
    id: int
    name: str
    description: str


class SymptomListResponse(BaseModel):
    items: list[SymptomItem]
    total: int
