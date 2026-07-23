import json
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from peewee import PostgresqlDatabase

from app.api.dependencies import get_current_user
from app.db.database import database, database_connection
from app.models.article_revision import ArticleRevision
from app.models.comment import Comment, CommentThread
from app.models.symptom import Symptom
from app.models.user import User
from app.schemas.comment import (
    CommentItem,
    CommentReplyCreate,
    CommentThreadCreate,
    CommentThreadItem,
    CommentThreadListResponse,
)

article_router = APIRouter(
    prefix="/articles",
    dependencies=[Depends(database_connection)],
)
router = APIRouter(
    prefix="/comments",
    dependencies=[Depends(database_connection)],
)

BLOCK_TYPES = {
    "blockquote",
    "bulletList",
    "codeBlock",
    "heading",
    "listItem",
    "orderedList",
    "paragraph",
}


def extract_plain_text(body: str) -> str:
    """Return the text a reader sees from Tiptap JSON or legacy Markdown."""
    try:
        document = json.loads(body)
    except (json.JSONDecodeError, TypeError):
        return body

    if not isinstance(document, (dict, list)):
        return body

    parts: list[str] = []

    def visit(node: object) -> None:
        if isinstance(node, list):
            for child in node:
                visit(child)
            return
        if not isinstance(node, dict):
            return

        node_type = node.get("type")
        if node_type == "text":
            text = node.get("text")
            if isinstance(text, str):
                parts.append(text)
            return
        if node_type == "hardBreak":
            parts.append("\n")
            return
        if node_type == "inlineFormula":
            attrs = node.get("attrs")
            if isinstance(attrs, dict):
                formula = attrs.get("formula")
                if isinstance(formula, str):
                    parts.append(formula)
            return

        visit(node.get("content", []))
        if node_type in BLOCK_TYPES and parts and parts[-1] != "\n":
            parts.append("\n")

    visit(document)
    return "".join(parts)


def find_anchor(
    text: str,
    quote: str,
    prefix: str = "",
    suffix: str = "",
    hint_offset: int | None = None,
) -> tuple[int, int] | None:
    positions: list[int] = []
    cursor = 0
    while True:
        position = text.find(quote, cursor)
        if position < 0:
            break
        positions.append(position)
        cursor = position + 1

    if not positions:
        return None

    contextual = [
        position
        for position in positions
        if (not prefix or text[:position].endswith(prefix))
        and (not suffix or text[position + len(quote) :].startswith(suffix))
    ]
    candidates = contextual or positions
    if len(candidates) == 1:
        return candidates[0], candidates[0] + len(quote)
    if hint_offset is None:
        return None

    distance = min(abs(position - hint_offset) for position in candidates)
    nearest = [position for position in candidates if abs(position - hint_offset) == distance]
    if len(nearest) != 1:
        return None
    return nearest[0], nearest[0] + len(quote)


def relocate_comment_threads(symptom_id: int, revision: ArticleRevision) -> None:
    text = extract_plain_text(revision.body)
    threads = CommentThread.select().where(CommentThread.symptom == symptom_id)
    for thread in threads:
        hint_offset = (
            thread.current_start_offset
            if thread.current_start_offset is not None
            else thread.start_offset
        )
        anchor = find_anchor(
            text,
            thread.quote,
            thread.prefix,
            thread.suffix,
            hint_offset,
        )
        thread.current_revision = revision
        thread.current_start_offset = anchor[0] if anchor else None
        thread.current_end_offset = anchor[1] if anchor else None
        thread.is_detached = anchor is None
        thread.save(
            only=[
                CommentThread.current_revision,
                CommentThread.current_start_offset,
                CommentThread.current_end_offset,
                CommentThread.is_detached,
            ]
        )


def get_public_symptom(symptom_id: int) -> Symptom:
    symptom = Symptom.get_or_none((Symptom.id == symptom_id) & Symptom.is_published)
    if symptom is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="故障现象不存在",
        )
    return symptom


def get_thread_or_404(thread_id: int) -> CommentThread:
    thread = CommentThread.get_or_none(CommentThread.id == thread_id)
    if thread is None or not thread.symptom.is_published:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="评论线程不存在",
        )
    return thread


def serialize_thread(thread: CommentThread) -> CommentThreadItem:
    comments = (
        Comment.select(Comment, User)
        .join(User)
        .where(Comment.thread == thread)
        .order_by(Comment.created_at, Comment.id)
    )
    resolved_by = (
        User.get_or_none(User.id == thread.resolved_by_id) if thread.resolved_by_id else None
    )
    return CommentThreadItem(
        id=thread.id,
        symptom_id=thread.symptom_id,
        revision_id=thread.revision_id,
        current_revision_id=thread.current_revision_id,
        author_id=thread.author_id,
        author_name=thread.author.username,
        resolved_by_id=thread.resolved_by_id,
        resolved_by_name=resolved_by.username if resolved_by else None,
        quote=thread.quote,
        prefix=thread.prefix,
        suffix=thread.suffix,
        block_id=thread.block_id,
        start_offset=thread.start_offset,
        end_offset=thread.end_offset,
        current_start_offset=thread.current_start_offset,
        current_end_offset=thread.current_end_offset,
        is_detached=thread.is_detached,
        status=thread.status,
        comments=[
            CommentItem(
                id=comment.id,
                author_id=comment.author_id,
                author_name=comment.author.username,
                body=comment.body,
                created_at=comment.created_at,
            )
            for comment in comments
        ],
        created_at=thread.created_at,
        updated_at=thread.updated_at,
        resolved_at=thread.resolved_at,
    )


@article_router.get(
    "/{symptom_id}/comments",
    response_model=CommentThreadListResponse,
)
def list_comment_threads(
    symptom_id: int,
    revision_id: Annotated[int | None, Query(gt=0)] = None,
    thread_status: Annotated[
        Literal["open", "resolved", "all"],
        Query(alias="status"),
    ] = "all",
) -> CommentThreadListResponse:
    get_public_symptom(symptom_id)
    target_revision_id = revision_id
    if target_revision_id is None:
        target_revision_id = (
            ArticleRevision.select(ArticleRevision.id)
            .where((ArticleRevision.symptom == symptom_id) & (ArticleRevision.status == "approved"))
            .order_by(ArticleRevision.published_at.desc())
            .scalar()
        )
    if target_revision_id is None:
        return CommentThreadListResponse(items=[], total=0)

    query = CommentThread.select().where(
        (CommentThread.symptom == symptom_id)
        & (CommentThread.current_revision == target_revision_id)
    )
    if thread_status != "all":
        query = query.where(CommentThread.status == thread_status)
    threads = list(query.order_by(CommentThread.created_at, CommentThread.id))
    return CommentThreadListResponse(
        items=[serialize_thread(thread) for thread in threads],
        total=len(threads),
    )


@article_router.post(
    "/{symptom_id}/comments",
    response_model=CommentThreadItem,
    status_code=status.HTTP_201_CREATED,
)
def create_comment_thread(
    symptom_id: int,
    payload: CommentThreadCreate,
    current_user: Annotated[User, Depends(get_current_user)],
) -> CommentThreadItem:
    get_public_symptom(symptom_id)
    with database.atomic():
        revision_query = ArticleRevision.select().where(
            (ArticleRevision.id == payload.revision_id) & (ArticleRevision.symptom == symptom_id)
        )
        if isinstance(database, PostgresqlDatabase):
            revision_query = revision_query.for_update()
        revision = revision_query.first()
        if revision is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="公开版本不存在",
            )
        if revision.status == "superseded":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="公开版本已经更新，请刷新后在最新版本上评论",
            )
        if revision.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="公开版本不存在",
            )

        text = extract_plain_text(revision.body)
        anchor = find_anchor(
            text,
            payload.quote,
            payload.prefix,
            payload.suffix,
            payload.start_offset,
        )
        if anchor is None and text[payload.start_offset : payload.end_offset] == payload.quote:
            anchor = payload.start_offset, payload.end_offset
        if anchor is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="选中文字不属于这个文档版本，或无法唯一定位",
            )

        now = datetime.now()
        thread = CommentThread.create(
            symptom=symptom_id,
            revision=revision,
            current_revision=revision,
            author=current_user,
            quote=payload.quote,
            prefix=payload.prefix,
            suffix=payload.suffix,
            block_id=payload.block_id,
            start_offset=anchor[0],
            end_offset=anchor[1],
            current_start_offset=anchor[0],
            current_end_offset=anchor[1],
            created_at=now,
            updated_at=now,
        )
        Comment.create(
            thread=thread,
            author=current_user,
            body=payload.body,
            created_at=now,
        )
    return serialize_thread(thread)


@router.post(
    "/{thread_id}/replies",
    response_model=CommentThreadItem,
    status_code=status.HTTP_201_CREATED,
)
def reply_to_thread(
    thread_id: int,
    payload: CommentReplyCreate,
    current_user: Annotated[User, Depends(get_current_user)],
) -> CommentThreadItem:
    thread = get_thread_or_404(thread_id)
    if thread.status == "resolved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="评论已解决，请先重新打开",
        )
    now = datetime.now()
    with database.atomic():
        Comment.create(
            thread=thread,
            author=current_user,
            body=payload.body,
            created_at=now,
        )
        thread.updated_at = now
        thread.save(only=[CommentThread.updated_at])
    return serialize_thread(thread)


def ensure_can_change_status(thread: CommentThread, current_user: User) -> None:
    if thread.author_id != current_user.id and current_user.role != "reviewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有发起者或审核员可以修改评论状态",
        )


@router.post("/{thread_id}/resolve", response_model=CommentThreadItem)
def resolve_thread(
    thread_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
) -> CommentThreadItem:
    thread = get_thread_or_404(thread_id)
    ensure_can_change_status(thread, current_user)
    if thread.status != "resolved":
        now = datetime.now()
        thread.status = "resolved"
        thread.resolved_by = current_user
        thread.resolved_at = now
        thread.updated_at = now
        thread.save()
    return serialize_thread(thread)


@router.post("/{thread_id}/reopen", response_model=CommentThreadItem)
def reopen_thread(
    thread_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
) -> CommentThreadItem:
    thread = get_thread_or_404(thread_id)
    ensure_can_change_status(thread, current_user)
    if thread.status != "open":
        thread.status = "open"
        thread.resolved_by = None
        thread.resolved_at = None
        thread.updated_at = datetime.now()
        thread.save()
    return serialize_thread(thread)
