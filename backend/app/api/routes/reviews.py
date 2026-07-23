from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_reviewer
from app.api.routes.articles import serialize_revision
from app.api.routes.comments import relocate_comment_threads
from app.db.database import database, database_connection
from app.models.article_revision import ArticleRevision
from app.models.symptom import Symptom
from app.models.user import User
from app.schemas.article import (
    ArticleRevisionItem,
    ReviewDecision,
    ReviewQueueItem,
    ReviewQueueResponse,
)

router = APIRouter(
    prefix="/reviews",
    dependencies=[Depends(database_connection)],
)


def get_pending_revision(revision_id: int) -> ArticleRevision:
    revision = (
        ArticleRevision.select(ArticleRevision, User)
        .join(User, on=(ArticleRevision.author == User.id))
        .where((ArticleRevision.id == revision_id) & (ArticleRevision.status == "pending"))
        .first()
    )
    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="待审核版本不存在或已经处理",
        )
    return revision


def serialize_review_item(revision: ArticleRevision) -> ReviewQueueItem:
    base_revision = (
        ArticleRevision.select(ArticleRevision, User)
        .join(User, on=(ArticleRevision.author == User.id))
        .where(ArticleRevision.id == revision.base_revision_id)
        .first()
        if revision.base_revision_id
        else None
    )
    return ReviewQueueItem(
        revision=serialize_revision(revision),
        base_revision=(serialize_revision(base_revision) if base_revision else None),
    )


@router.get("", response_model=ReviewQueueResponse)
def list_pending_reviews(
    _: Annotated[User, Depends(get_reviewer)],
) -> ReviewQueueResponse:
    revisions = (
        ArticleRevision.select(ArticleRevision, User)
        .join(User, on=(ArticleRevision.author == User.id))
        .where(ArticleRevision.status == "pending")
        .order_by(ArticleRevision.submitted_at)
    )
    items = [serialize_review_item(revision) for revision in revisions]
    return ReviewQueueResponse(items=items, total=len(items))


@router.post("/{revision_id}/approve", response_model=ArticleRevisionItem)
def approve_revision(
    revision_id: int,
    payload: ReviewDecision,
    reviewer: Annotated[User, Depends(get_reviewer)],
) -> ArticleRevisionItem:
    revision = get_pending_revision(revision_id)
    if revision.author_id == reviewer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="审核员不能审核自己提交的版本",
        )
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
        revision.reviewer = reviewer
        revision.review_note = payload.note
        revision.reviewed_at = now
        revision.published_at = now
        revision.updated_at = now
        revision.save()
        Symptom.update(is_published=True).where(Symptom.id == revision.symptom_id).execute()
        relocate_comment_threads(revision.symptom_id, revision)
    return serialize_revision(revision)


@router.post("/{revision_id}/reject", response_model=ArticleRevisionItem)
def reject_revision(
    revision_id: int,
    payload: ReviewDecision,
    reviewer: Annotated[User, Depends(get_reviewer)],
) -> ArticleRevisionItem:
    if not payload.note:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="驳回时必须填写原因",
        )
    revision = get_pending_revision(revision_id)
    if revision.author_id == reviewer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="审核员不能审核自己提交的版本",
        )
    revision.status = "rejected"
    revision.reviewer = reviewer
    revision.review_note = payload.note
    revision.reviewed_at = datetime.now()
    revision.updated_at = revision.reviewed_at
    revision.save()
    return serialize_revision(revision)
