from fastapi import APIRouter

from app.api.routes import articles, auth, comments, health, reviews, symptoms, uploads

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(symptoms.router, tags=["symptoms"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(articles.router, tags=["articles"])
api_router.include_router(comments.article_router, tags=["comments"])
api_router.include_router(comments.router, tags=["comments"])
api_router.include_router(uploads.router, tags=["uploads"])
api_router.include_router(reviews.router, tags=["reviews"])
