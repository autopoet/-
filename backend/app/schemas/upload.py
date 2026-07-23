from pydantic import BaseModel


class ImageUploadItem(BaseModel):
    url: str
    media_type: str
    size: int
