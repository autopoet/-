from datetime import datetime
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status

from app.core.config import settings
from app.core.security import hash_session_token
from app.models.user import AuthSession, User


def get_optional_current_user(
    session_token: Annotated[
        str | None,
        Cookie(alias=settings.session_cookie_name),
    ] = None,
) -> User | None:
    if not session_token:
        return None

    session = (
        AuthSession.select(AuthSession, User)
        .join(User)
        .where(AuthSession.token_hash == hash_session_token(session_token))
        .first()
    )
    if session is None or session.expires_at <= datetime.now():
        if session is not None:
            session.delete_instance()
        return None

    return session.user


def get_current_user(
    current_user: Annotated[User | None, Depends(get_optional_current_user)],
) -> User:
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录",
        )
    return current_user


def get_reviewer(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.role != "reviewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅审核员可以执行此操作",
        )
    return current_user
