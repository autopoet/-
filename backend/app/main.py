import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

from app.api.router import api_router
from app.core.config import settings
from app.services.image_storage import public_image_url, validate_configuration

IMAGE_NAME = re.compile(r"^[A-Za-z0-9_-]+\.(?:jpg|png|webp)$")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.database_url.startswith("sqlite"):
        Path("data").mkdir(exist_ok=True)

    if settings.storage_backend == "local":
        Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    validate_configuration()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def reject_writes_during_maintenance(request: Request, call_next):
    if settings.maintenance_read_only and request.method not in {"GET", "HEAD", "OPTIONS"}:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": "网站正在维护，暂时只能阅读"},
        )
    return await call_next(request)


app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/uploads/{filename}", include_in_schema=False)
def uploaded_image(filename: str):
    if not IMAGE_NAME.fullmatch(filename):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    if settings.storage_backend == "supabase":
        return RedirectResponse(public_image_url(filename))

    path = Path(settings.upload_dir) / filename
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return FileResponse(path)


@app.get("/{path:path}", include_in_schema=False)
def frontend_app(path: str):
    if not settings.frontend_dist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    root = Path(settings.frontend_dist).resolve()
    candidate = (root / path).resolve()
    if root == candidate or root in candidate.parents:
        if candidate.is_file():
            return FileResponse(candidate)
    if Path(path).suffix:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    index = root / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return FileResponse(index)
