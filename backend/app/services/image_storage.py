from pathlib import Path
from urllib.parse import quote

import httpx

from app.core.config import settings


class ImageStorageError(RuntimeError):
    pass


def validate_configuration() -> None:
    if settings.storage_backend != "supabase":
        return

    missing = [
        name
        for name, value in (
            ("APP_SUPABASE_URL", settings.supabase_url),
            ("APP_SUPABASE_SECRET_KEY", settings.supabase_secret_key),
            ("APP_SUPABASE_STORAGE_BUCKET", settings.supabase_storage_bucket),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(f"Supabase Storage 缺少配置：{', '.join(missing)}")


def _object_url(filename: str, *, public: bool = False) -> str:
    base = settings.supabase_url.rstrip("/")
    bucket = quote(settings.supabase_storage_bucket, safe="")
    object_name = quote(filename, safe="")
    visibility = "public/" if public else ""
    return f"{base}/storage/v1/object/{visibility}{bucket}/{object_name}"


async def _upload_to_supabase(filename: str, data: bytes, media_type: str) -> None:
    validate_configuration()
    key = settings.supabase_secret_key
    headers = {
        "apikey": key,
        "Content-Type": media_type,
        "Cache-Control": "31536000",
        "x-upsert": "false",
    }
    if not key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {key}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                _object_url(filename),
                content=data,
                headers=headers,
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ImageStorageError("图片存储服务暂时不可用") from exc


async def save_image(filename: str, data: bytes, media_type: str) -> None:
    if settings.storage_backend == "supabase":
        await _upload_to_supabase(filename, data, media_type)
        return

    directory = Path(settings.upload_dir)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / filename).write_bytes(data)


def public_image_url(filename: str) -> str:
    validate_configuration()
    return _object_url(filename, public=True)
