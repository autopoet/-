from pydantic import BaseModel, ConfigDict


class SymptomItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str


class SymptomListResponse(BaseModel):
    items: list[SymptomItem]
    total: int
