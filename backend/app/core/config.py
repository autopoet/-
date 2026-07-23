from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "电赛白皮书 API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "sqlite:///data/app.db"
    frontend_origin: str = "http://localhost:5173"
    session_cookie_name: str = "diansai_session"
    session_days: int = 7
    secure_cookies: bool = False
    frontend_dist: str = ""
    maintenance_read_only: bool = False
    upload_dir: str = "data/uploads"
    max_image_bytes: int = 10 * 1024 * 1024
    storage_backend: Literal["local", "supabase"] = "local"
    supabase_url: str = ""
    supabase_secret_key: str = ""
    supabase_storage_bucket: str = "article-images"
    seed_reviewer_username: str = "demo_reviewer"
    seed_reviewer_password: str = "reviewer-local-123"
    seed_contributor_username: str = "demo_contributor"
    seed_contributor_password: str = "contributor-local-123"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="APP_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
