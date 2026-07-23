from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from peewee import fn

from app.api.dependencies import get_optional_current_user
from app.db.database import database_connection
from app.models.article_revision import ArticleRevision
from app.models.symptom import Symptom
from app.models.user import User
from app.schemas.symptom import SymptomItem, SymptomListResponse

router = APIRouter(dependencies=[Depends(database_connection)])


@router.get("/symptoms", response_model=SymptomListResponse)
def list_symptoms(
    keyword: Annotated[
        str | None,
        Query(
            min_length=2,
            max_length=20,
            description="搜索故障名称或描述",
        ),
    ] = None,
) -> SymptomListResponse:
    query = Symptom.select().where(Symptom.is_published).order_by(Symptom.id)

    if keyword is not None:
        normalized_keyword = keyword.casefold()
        query = query.where(
            fn.LOWER(Symptom.name).contains(normalized_keyword)
            | fn.LOWER(Symptom.description).contains(normalized_keyword)
        )

    items = [SymptomItem.model_validate(symptom) for symptom in query]

    return SymptomListResponse(
        items=items,
        total=len(items),
    )


@router.get("/symptoms/{symptom_id}", response_model=SymptomItem)
def get_symptom(
    symptom_id: int,
    current_user: Annotated[User | None, Depends(get_optional_current_user)],
) -> SymptomItem:
    symptom = Symptom.get_or_none(Symptom.id == symptom_id)

    can_view_unpublished = current_user is not None and (
        current_user.role == "reviewer"
        or ArticleRevision.select()
        .where((ArticleRevision.symptom == symptom_id) & (ArticleRevision.author == current_user))
        .exists()
    )
    if symptom is None or (not symptom.is_published and not can_view_unpublished):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="故障现象不存在",
        )

    return SymptomItem.model_validate(symptom)
