import asyncio

from app.core.config import settings
from app.services import image_storage


def test_new_supabase_secret_key_is_not_sent_as_bearer(monkeypatch) -> None:
    request: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            pass

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            pass

        async def post(self, url: str, **kwargs):
            request.update(url=url, **kwargs)
            return FakeResponse()

    monkeypatch.setattr(settings, "storage_backend", "supabase")
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_secret_key", "sb_secret_server")
    monkeypatch.setattr(settings, "supabase_storage_bucket", "article-images")
    monkeypatch.setattr(image_storage.httpx, "AsyncClient", lambda **_: FakeClient())

    asyncio.run(image_storage._upload_to_supabase("scope.png", b"image", "image/png"))

    assert request["url"] == (
        "https://project.supabase.co/storage/v1/object/article-images/scope.png"
    )
    assert request["headers"]["apikey"] == "sb_secret_server"
    assert "Authorization" not in request["headers"]
