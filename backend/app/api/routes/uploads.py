from pathlib import Path
from secrets import token_urlsafe
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.db.database import database_connection
from app.models.user import User
from app.schemas.upload import ImageUploadItem

router = APIRouter(
    prefix="/uploads",
    dependencies=[Depends(database_connection)],
)


def image_type(data: bytes) -> tuple[str, str] | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png", "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg", "image/jpeg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp", "image/webp"
    return None


@router.post(
    "/images",
    response_model=ImageUploadItem,
    status_code=status.HTTP_201_CREATED,
)
async def upload_image(
    current_user: Annotated[User, Depends(get_current_user)],
    file: Annotated[UploadFile, File()],
) -> ImageUploadItem:
    del current_user
    data = await file.read(settings.max_image_bytes + 1)
    if len(data) > settings.max_image_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="图片不能超过 10 MB",
        )

    detected = image_type(data)
    if detected is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="只支持 JPG、PNG 和 WebP 图片",
        )

    extension, media_type = detected
    directory = Path(settings.upload_dir)
    directory.mkdir(parents=True, exist_ok=True)
    filename = f"{token_urlsafe(18)}.{extension}"
    (directory / filename).write_bytes(data)
    return ImageUploadItem(
        url=f"/uploads/{filename}",
        media_type=media_type,
        size=len(data),
    )
