import json
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_current_user
from app.db.database import database_connection
from app.models.article_revision import ArticleRevision
from app.models.symptom import Symptom
from app.models.user import User
from app.schemas.article import (
    ArticleDraftPayload,
    ArticleRevisionItem,
    RevisionListResponse,
)

router = APIRouter(
    prefix="/articles",
    dependencies=[Depends(database_connection)],
)


def serialize_revision(revision: ArticleRevision) -> ArticleRevisionItem:
    return ArticleRevisionItem(
        id=revision.id,
        symptom_id=revision.symptom_id,
        author_id=revision.author_id,
        author_name=revision.author.username,
        status=revision.status,
        title=revision.title,
        summary=revision.summary,
        applicability=revision.applicability,
        safety=revision.safety,
        checklist=json.loads(revision.checklist_json),
        body=revision.body,
        review_note=revision.review_note,
        created_at=revision.created_at,
        updated_at=revision.updated_at,
        submitted_at=revision.submitted_at,
        published_at=revision.published_at,
    )


def get_symptom_or_404(symptom_id: int) -> Symptom:
    symptom = Symptom.get_or_none(Symptom.id == symptom_id)
    if symptom is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="故障现象不存在",
        )
    return symptom


@router.get("/mine", response_model=RevisionListResponse)
def list_my_revisions(
    current_user: Annotated[User, Depends(get_current_user)],
) -> RevisionListResponse:
    revisions = (
        ArticleRevision.select(ArticleRevision, User)
        .join(User)
        .where(ArticleRevision.author == current_user)
        .order_by(ArticleRevision.updated_at.desc())
    )
    items = [serialize_revision(revision) for revision in revisions]
    return RevisionListResponse(items=items, total=len(items))


@router.get("/{symptom_id}", response_model=ArticleRevisionItem)
def get_published_article(symptom_id: int) -> ArticleRevisionItem:
    get_symptom_or_404(symptom_id)
    revision = (
        ArticleRevision.select(ArticleRevision, User)
        .join(User)
        .where(
            (ArticleRevision.symptom == symptom_id)
            & (ArticleRevision.status == "approved")
        )
        .order_by(ArticleRevision.published_at.desc())
        .first()
    )
    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="这篇文档还没有已发布版本",
        )
    return serialize_revision(revision)


@router.get("/{symptom_id}/draft", response_model=ArticleRevisionItem)
def get_draft(
    symptom_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
) -> ArticleRevisionItem:
    get_symptom_or_404(symptom_id)
    revision = (
        ArticleRevision.select(ArticleRevision, User)
        .join(User)
        .where(
            (ArticleRevision.symptom == symptom_id)
            & (ArticleRevision.author == current_user)
            & (ArticleRevision.status.in_(("draft", "rejected")))
        )
        .order_by(ArticleRevision.updated_at.desc())
        .first()
    )
    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="没有可继续编辑的草稿",
        )
    return serialize_revision(revision)


@router.put("/{symptom_id}/draft", response_model=ArticleRevisionItem)
def save_draft(
    symptom_id: int,
    payload: ArticleDraftPayload,
    current_user: Annotated[User, Depends(get_current_user)],
) -> ArticleRevisionItem:
    symptom = get_symptom_or_404(symptom_id)
    revision = (
        ArticleRevision.select()
        .where(
            (ArticleRevision.symptom == symptom)
            & (ArticleRevision.author == current_user)
            & (ArticleRevision.status.in_(("draft", "rejected")))
        )
        .order_by(ArticleRevision.updated_at.desc())
        .first()
    )
    values = {
        "title": payload.title,
        "summary": payload.summary,
        "applicability": payload.applicability,
        "safety": payload.safety,
        "checklist_json": json.dumps(payload.checklist, ensure_ascii=False),
        "body": payload.body,
        "status": "draft",
        "review_note": "",
        "updated_at": datetime.now(),
    }
    if revision is None:
        revision = ArticleRevision.create(
            symptom=symptom,
            author=current_user,
            **values,
        )
    else:
        ArticleRevision.update(**values).where(
            ArticleRevision.id == revision.id
        ).execute()
        revision = ArticleRevision.get_by_id(revision.id)

    revision.author = current_user
    return serialize_revision(revision)


@router.post("/{symptom_id}/submit", response_model=ArticleRevisionItem)
def submit_draft(
    symptom_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
) -> ArticleRevisionItem:
    revision = (
        ArticleRevision.select(ArticleRevision, User)
        .join(User)
        .where(
            (ArticleRevision.symptom == symptom_id)
            & (ArticleRevision.author == current_user)
            & (ArticleRevision.status == "draft")
        )
        .order_by(ArticleRevision.updated_at.desc())
        .first()
    )
    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="请先保存草稿",
        )

    now = datetime.now()
    revision.status = "pending"
    revision.submitted_at = now
    revision.updated_at = now
    revision.save()
    return serialize_revision(revision)
