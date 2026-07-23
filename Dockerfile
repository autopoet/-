FROM node:22-alpine AS frontend-build

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build


FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_FRONTEND_DIST=/app/frontend-dist

WORKDIR /app/backend
COPY backend/pyproject.toml ./
COPY backend/app ./app
RUN pip install --no-cache-dir ".[postgres]"

COPY --from=frontend-build /build/dist /app/frontend-dist

CMD ["sh", "-c", "python -m app.db.seed && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
