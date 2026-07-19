from fastapi import APIRouter

from app.api.routes import health, symptoms

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(symptoms.router, tags=["symptoms"])

