import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  CornerDownRight,
  Link2Off,
  MessageSquareText,
  RotateCcw,
  Send,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  commentKeys,
  createCommentThread,
  listCommentThreads,
  reopenCommentThread,
  replyToCommentThread,
  resolveCommentThread,
} from '../api/comments'
import type { User } from '../api/auth'
import { ApiError } from '../api/client'
import styles from './article-comments-panel.module.css'

export type CommentAnchorDraft = {
  quote: string
  startOffset: number
  endOffset: number
  prefix: string
  suffix: string
  blockId: string | null
}

export function ArticleCommentsPanel({
  symptomId,
  revisionId,
  currentUser,
  selectedAnchor,
  activeThreadId,
  onClearSelection,
  onActivateThread,
  onClose,
}: {
  symptomId: number
  revisionId: number
  currentUser?: User
  selectedAnchor: CommentAnchorDraft | null
  activeThreadId: number | null
  onClearSelection: () => void
  onActivateThread: (threadId: number | null) => void
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'open' | 'resolved'>('open')
  const [commentBody, setCommentBody] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const comments = useQuery({
    queryKey: commentKeys.article(symptomId),
    queryFn: ({ signal }) => listCommentThreads(symptomId, signal),
    enabled: revisionId > 0,
  })

  const visibleThreads = useMemo(
    () => comments.data?.items.filter((thread) => thread.status === filter) ?? [],
    [comments.data?.items, filter],
  )
  const activeThread = comments.data?.items.find(
    (thread) => thread.id === activeThreadId,
  )

  useEffect(() => {
    if (!activeThreadId) return
    window.setTimeout(() => {
      document
        .getElementById(`comment-thread-${activeThreadId}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 0)
  }, [activeThreadId, comments.dataUpdatedAt])

  function refresh() {
    return queryClient.invalidateQueries({
      queryKey: commentKeys.article(symptomId),
    })
  }

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedAnchor) throw new Error('没有选中的正文')
      return createCommentThread(symptomId, {
        revision_id: revisionId,
        quote: selectedAnchor.quote,
        start_offset: selectedAnchor.startOffset,
        end_offset: selectedAnchor.endOffset,
        prefix: selectedAnchor.prefix,
        suffix: selectedAnchor.suffix,
        block_id: selectedAnchor.blockId,
        body: commentBody.trim(),
      })
    },
    onSuccess: async (thread) => {
      setCommentBody('')
      onClearSelection()
      setFilter('open')
      onActivateThread(thread.id)
      await refresh()
    },
  })
  const replyMutation = useMutation({
    mutationFn: () => replyToCommentThread(activeThreadId!, replyBody.trim()),
    onSuccess: async () => {
      setReplyBody('')
      await refresh()
    },
  })
  const stateMutation = useMutation({
    mutationFn: ({ id, next }: { id: number; next: 'open' | 'resolved' }) =>
      next === 'resolved'
        ? resolveCommentThread(id)
        : reopenCommentThread(id),
    onSuccess: async (thread) => {
      setFilter(thread.status)
      onActivateThread(thread.id)
      await refresh()
    },
  })

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (commentBody.trim()) createMutation.mutate()
  }

  function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (replyBody.trim() && activeThreadId) replyMutation.mutate()
  }

  const mutationError =
    createMutation.error ?? replyMutation.error ?? stateMutation.error

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <div>
          <span>文档讨论</span>
          <h2 id="comments-title">评论</h2>
        </div>
        <button type="button" aria-label="关闭评论" onClick={onClose}>
          <X aria-hidden="true" size={20} />
        </button>
      </header>

      {selectedAnchor ? (
        <form className={styles.composer} onSubmit={submitComment}>
          <div className={styles.quoteHeader}>
            <span>选中的原文</span>
            <button type="button" onClick={onClearSelection}>
              取消
            </button>
          </div>
          <blockquote>{selectedAnchor.quote}</blockquote>
          {currentUser ? (
            <>
              <label>
                评论
                <textarea
                  autoFocus
                  required
                  maxLength={5000}
                  rows={4}
                  placeholder="指出疑问、缺失条件或需要补充验证的地方…"
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                />
              </label>
              <button
                className={styles.primaryAction}
                type="submit"
                disabled={!commentBody.trim() || createMutation.isPending}
              >
                <Send aria-hidden="true" size={16} />
                发布评论
              </button>
            </>
          ) : (
            <Link
              className={styles.loginLink}
              to={`/login?from=${encodeURIComponent(`/articles/${symptomId}`)}`}
            >
              登录后评论
            </Link>
          )}
        </form>
      ) : null}

      <div className={styles.filters} role="group" aria-label="评论状态">
        <button
          type="button"
          aria-pressed={filter === 'open'}
          onClick={() => setFilter('open')}
        >
          未解决
          <span>
            {comments.data?.items.filter((thread) => thread.status === 'open').length ?? 0}
          </span>
        </button>
        <button
          type="button"
          aria-pressed={filter === 'resolved'}
          onClick={() => setFilter('resolved')}
        >
          已解决
          <span>
            {comments.data?.items.filter((thread) => thread.status === 'resolved').length ?? 0}
          </span>
        </button>
      </div>

      {comments.isLoading ? (
        <p className={styles.stateText}>正在读取讨论…</p>
      ) : null}
      {comments.isError ? (
        <button className={styles.retry} type="button" onClick={() => comments.refetch()}>
          评论加载失败，重新加载
        </button>
      ) : null}

      <ol className={styles.threadList}>
        {visibleThreads.map((thread) => (
          <li
            id={`comment-thread-${thread.id}`}
            key={thread.id}
            data-active={thread.id === activeThreadId}
          >
            <button
              className={styles.threadQuote}
              type="button"
              onClick={() => onActivateThread(thread.id)}
            >
              {thread.is_detached ? (
                <Link2Off aria-hidden="true" size={15} />
              ) : (
                <MessageSquareText aria-hidden="true" size={15} />
              )}
              <span>{thread.quote}</span>
            </button>
            {thread.is_detached ? (
              <p className={styles.detached}>原文已变更，保留创建时引用。</p>
            ) : null}
            <ol className={styles.commentList}>
              {thread.comments.map((comment) => (
                <li key={comment.id}>
                  <div>
                    <strong>{comment.author_name}</strong>
                    <time dateTime={comment.created_at}>
                      {new Date(comment.created_at).toLocaleString('zh-CN')}
                    </time>
                  </div>
                  <p>{comment.body}</p>
                </li>
              ))}
            </ol>
            <footer className={styles.threadActions}>
              {currentUser &&
              (currentUser.id === thread.author_id ||
                currentUser.role === 'reviewer') ? (
                <button
                  type="button"
                  disabled={stateMutation.isPending}
                  onClick={() =>
                    stateMutation.mutate({
                      id: thread.id,
                      next: thread.status === 'open' ? 'resolved' : 'open',
                    })
                  }
                >
                  {thread.status === 'open' ? (
                    <CheckCircle2 aria-hidden="true" size={15} />
                  ) : (
                    <RotateCcw aria-hidden="true" size={15} />
                  )}
                  {thread.status === 'open' ? '解决' : '重新打开'}
                </button>
              ) : null}
              {thread.status === 'open' ? (
                <button type="button" onClick={() => onActivateThread(thread.id)}>
                  <CornerDownRight aria-hidden="true" size={15} />
                  回复
                </button>
              ) : null}
            </footer>
            {currentUser &&
            thread.status === 'open' &&
            activeThread?.id === thread.id ? (
              <form className={styles.replyForm} onSubmit={submitReply}>
                <label className="sr-only" htmlFor={`reply-${thread.id}`}>
                  回复评论
                </label>
                <textarea
                  id={`reply-${thread.id}`}
                  rows={2}
                  maxLength={5000}
                  placeholder="回复这条讨论…"
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                />
                <button
                  type="submit"
                  disabled={!replyBody.trim() || replyMutation.isPending}
                >
                  发送
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ol>

      {!comments.isLoading && visibleThreads.length === 0 ? (
        <div className={styles.empty}>
          <MessageSquareText aria-hidden="true" size={24} />
          <p>{filter === 'open' ? '还没有未解决的讨论。' : '还没有已解决的讨论。'}</p>
        </div>
      ) : null}

      {mutationError ? (
        <p className={styles.error} role="alert">
          {mutationError instanceof ApiError
            ? mutationError.message
            : '操作失败，请重试'}
        </p>
      ) : null}
    </div>
  )
}
