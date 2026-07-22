import json
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from peewee import fn

from app.api.dependencies import get_current_user
from app.db.database import database_connection
from app.models.article_revision import ArticleRevision
from app.models.favorite import Favorite
from app.models.symptom import Symptom
from app.models.user import User
from app.schemas.article import (
    ArticleDraftPayload,
    ArticleRevisionItem,
    ContributionItem,
    ContributionOverview,
    FavoriteItem,
    FavoriteListResponse,
    FavoriteState,
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
        reviewer_id=revision.reviewer_id,
        reviewer_name=(revision.reviewer.username if revision.reviewer_id else None),
        base_revision_id=revision.base_revision_id,
        version_number=revision.version_number,
        status=revision.status,
        title=revision.title,
        summary=revision.summary,
        applicability=revision.applicability,
        safety=revision.safety,
        checklist=json.loads(revision.checklist_json),
        body=revision.body,
        edit_summary=revision.edit_summary,
        review_note=revision.review_note,
        created_at=revision.created_at,
        updated_at=revision.updated_at,
        submitted_at=revision.submitted_at,
        reviewed_at=revision.reviewed_at,
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
        .join(User, on=(ArticleRevision.author == User.id))
        .where(ArticleRevision.author == current_user)
        .order_by(ArticleRevision.updated_at.desc())
    )
    items = [serialize_revision(revision) for revision in revisions]
    return RevisionListResponse(items=items, total=len(items))


@router.get("/mine/overview", response_model=ContributionOverview)
def get_contribution_overview(
    current_user: Annotated[User, Depends(get_current_user)],
) -> ContributionOverview:
    revisions = list(
        ArticleRevision.select()
        .where(ArticleRevision.author == current_user)
        .order_by(ArticleRevision.updated_at.desc())
    )
    return ContributionOverview(
        total=len(revisions),
        published=sum(revision.status in {"approved", "superseded"} for revision in revisions),
        pending=sum(revision.status == "pending" for revision in revisions),
        drafts=sum(revision.status in {"draft", "rejected"} for revision in revisions),
        recent=[
            ContributionItem(
                id=revision.id,
                symptom_id=revision.symptom_id,
                version_number=revision.version_number,
                status=revision.status,
                title=revision.title,
                edit_summary=revision.edit_summary,
                updated_at=revision.updated_at,
            )
            for revision in revisions[:6]
        ],
    )


@router.get("/favorites", response_model=FavoriteListResponse)
def list_favorites(
    current_user: Annotated[User, Depends(get_current_user)],
) -> FavoriteListResponse:
    favorites = list(
        Favorite.select(Favorite, Symptom)
        .join(Symptom)
        .where(Favorite.user == current_user)
        .order_by(Favorite.created_at.desc())
    )
    return FavoriteListResponse(
        items=[
            FavoriteItem(
                symptom_id=favorite.symptom_id,
                name=favorite.symptom.name,
                description=favorite.symptom.description,
                created_at=favorite.created_at,
            )
            for favorite in favorites
        ],
        total=len(favorites),
    )


@router.get("/{symptom_id}/favorite", response_model=FavoriteState)
def get_favorite_state(
    symptom_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
) -> FavoriteState:
    get_symptom_or_404(symptom_id)
    return FavoriteState(
        favorited=Favorite.select()
        .where((Favorite.user == current_user) & (Favorite.symptom == symptom_id))
        .exists()
    )


@router.post("/{symptom_id}/favorite", response_model=FavoriteState)
def add_favorite(
    symptom_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
) -> FavoriteState:
    symptom = get_symptom_or_404(symptom_id)
    Favorite.get_or_create(user=current_user, symptom=symptom)
    return FavoriteState(favorited=True)


@router.delete("/{symptom_id}/favorite", response_model=FavoriteState)
def remove_favorite(
    symptom_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
) -> FavoriteState:
    get_symptom_or_404(symptom_id)
    (
        Favorite.delete()
        .where((Favorite.user == current_user) & (Favorite.symptom == symptom_id))
        .execute()
    )
    return FavoriteState(favorited=False)


@router.get("/{symptom_id}", response_model=ArticleRevisionItem)
def get_published_article(symptom_id: int) -> ArticleRevisionItem:
    get_symptom_or_404(symptom_id)
    revision = (
        ArticleRevision.select(ArticleRevision, User)
        .join(User, on=(ArticleRevision.author == User.id))
        .where((ArticleRevision.symptom == symptom_id) & (ArticleRevision.status == "approved"))
        .order_by(ArticleRevision.published_at.desc())
        .first()
    )
    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="这篇文档还没有已发布版本",
        )
    return serialize_revision(revision)


@router.get("/{symptom_id}/revisions", response_model=RevisionListResponse)
def list_published_revisions(symptom_id: int) -> RevisionListResponse:
    get_symptom_or_404(symptom_id)
    revisions = (
        ArticleRevision.select(ArticleRevision, User)
        .join(User, on=(ArticleRevision.author == User.id))
        .where(
            (ArticleRevision.symptom == symptom_id)
            & (ArticleRevision.status.in_(("approved", "superseded")))
        )
        .order_by(ArticleRevision.version_number.desc())
    )
    items = [serialize_revision(revision) for revision in revisions]
    return RevisionListResponse(items=items, total=len(items))


@router.get("/{symptom_id}/draft", response_model=ArticleRevisionItem)
def get_draft(
    symptom_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
) -> ArticleRevisionItem:
    get_symptom_or_404(symptom_id)
    revision = (
        ArticleRevision.select(ArticleRevision, User)
        .join(User, on=(ArticleRevision.author == User.id))
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
            & (ArticleRevision.status == "draft")
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
        "edit_summary": payload.edit_summary,
        "status": "draft",
        "review_note": "",
        "updated_at": datetime.now(),
    }
    if revision is None:
        base_revision = (
            ArticleRevision.select()
            .where((ArticleRevision.symptom == symptom) & (ArticleRevision.status == "approved"))
            .order_by(ArticleRevision.published_at.desc())
            .first()
        )
        next_version = (
            ArticleRevision.select(fn.COALESCE(fn.MAX(ArticleRevision.version_number), 0) + 1)
            .where(ArticleRevision.symptom == symptom)
            .scalar()
        )
        revision = ArticleRevision.create(
            symptom=symptom,
            author=current_user,
            base_revision=base_revision,
            version_number=next_version,
            **values,
        )
    else:
        ArticleRevision.update(**values).where(ArticleRevision.id == revision.id).execute()
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
        .join(User, on=(ArticleRevision.author == User.id))
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

    if not revision.edit_summary.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="提交审核前请填写修改说明",
        )

    current_published = (
        ArticleRevision.select()
        .where((ArticleRevision.symptom == symptom_id) & (ArticleRevision.status == "approved"))
        .order_by(ArticleRevision.published_at.desc())
        .first()
    )
    current_published_id = current_published.id if current_published else None
    if revision.base_revision_id != current_published_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="公开版本已经更新，请重新载入并合并修改",
        )

    other_pending = (
        ArticleRevision.select()
        .where(
            (ArticleRevision.symptom == symptom_id)
            & (ArticleRevision.status == "pending")
            & (ArticleRevision.id != revision.id)
        )
        .exists()
    )
    if other_pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="这个条目已有待审核修改，请等待处理后再提交",
        )

    now = datetime.now()
    revision.status = "pending"
    revision.submitted_at = now
    revision.updated_at = now
    revision.save()
    return serialize_revision(revision)
