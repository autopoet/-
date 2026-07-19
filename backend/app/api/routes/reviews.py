from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_reviewer
from app.api.routes.articles import serialize_revision
from app.db.database import database, database_connection
from app.models.article_revision import ArticleRevision
from app.models.user import User
from app.schemas.article import (
    ArticleRevisionItem,
    ReviewDecision,
    RevisionListResponse,
)

router = APIRouter(
    prefix="/reviews",
    dependencies=[Depends(database_connection)],
)


def get_pending_revision(revision_id: int) -> ArticleRevision:
    revision = (
        ArticleRevision.select(ArticleRevision, User)
        .join(User)
        .where(
            (ArticleRevision.id == revision_id)
            & (ArticleRevision.status == "pending")
        )
        .first()
    )
    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="待审核版本不存在或已经处理",
        )
    return revision


@router.get("", response_model=RevisionListResponse)
def list_pending_reviews(
    _: Annotated[User, Depends(get_reviewer)],
) -> RevisionListResponse:
    revisions = (
        ArticleRevision.select(ArticleRevision, User)
        .join(User)
        .where(ArticleRevision.status == "pending")
        .order_by(ArticleRevision.submitted_at)
    )
    items = [serialize_revision(revision) for revision in revisions]
    return RevisionListResponse(items=items, total=len(items))


@router.post("/{revision_id}/approve", response_model=ArticleRevisionItem)
def approve_revision(
    revision_id: int,
    payload: ReviewDecision,
    _: Annotated[User, Depends(get_reviewer)],
) -> ArticleRevisionItem:
    revision = get_pending_revision(revision_id)
    now = datetime.now()
    with database.atomic():
        (
            ArticleRevision.update(status="superseded")
            .where(
                (ArticleRevision.symptom == revision.symptom_id)
                & (ArticleRevision.status == "approved")
            )
            .execute()
        )
        revision.status = "approved"
        revision.review_note = payload.note
        revision.published_at = now
        revision.updated_at = now
        revision.save()
    return serialize_revision(revision)


@router.post("/{revision_id}/reject", response_model=ArticleRevisionItem)
def reject_revision(
    revision_id: int,
    payload: ReviewDecision,
    _: Annotated[User, Depends(get_reviewer)],
) -> ArticleRevisionItem:
    if not payload.note:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="驳回时必须填写原因",
        )
    revision = get_pending_revision(revision_id)
    revision.status = "rejected"
    revision.review_note = payload.note
    revision.updated_at = datetime.now()
    revision.save()
    return serialize_revision(revision)
