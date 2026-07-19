from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from peewee import IntegrityError

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.security import (
    create_session_token,
    hash_password,
    hash_session_token,
    verify_password,
)
from app.db.database import database, database_connection
from app.models.user import AuthSession, User
from app.schemas.auth import Credentials, UserItem

router = APIRouter(
    prefix="/auth",
    dependencies=[Depends(database_connection)],
)


def start_session(response: Response, user: User) -> None:
    token, token_hash = create_session_token()
    expires_at = datetime.now() + timedelta(days=settings.session_days)
    AuthSession.create(
        user=user,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        max_age=settings.session_days * 24 * 60 * 60,
        path="/",
    )


@router.post("/register", response_model=UserItem, status_code=status.HTTP_201_CREATED)
def register(payload: Credentials, response: Response) -> UserItem:
    try:
        with database.atomic():
            role = "reviewer" if User.select().count() == 0 else "contributor"
            user = User.create(
                username=payload.username,
                password_hash=hash_password(payload.password),
                role=role,
            )
            start_session(response, user)
    except IntegrityError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="用户名已被使用",
        ) from error

    return UserItem.model_validate(user)


@router.post("/login", response_model=UserItem)
def login(payload: Credentials, response: Response) -> UserItem:
    user = User.get_or_none(User.username == payload.username)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )

    start_session(response, user)
    return UserItem.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    session_token: Annotated[
        str | None,
        Cookie(alias=settings.session_cookie_name),
    ] = None,
) -> None:
    if session_token:
        AuthSession.delete().where(
            AuthSession.token_hash == hash_session_token(session_token)
        ).execute()
    response.delete_cookie(settings.session_cookie_name, path="/")


@router.get("/me", response_model=UserItem)
def me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserItem:
    return UserItem.model_validate(current_user)
