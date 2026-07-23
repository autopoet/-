import { apiRequest } from './client'

export type CommentItem = {
  id: number
  author_id: number
  author_name: string
  body: string
  created_at: string
}

export type CommentThread = {
  id: number
  symptom_id: number
  revision_id: number
  current_revision_id: number | null
  author_id: number
  author_name: string
  resolved_by_id: number | null
  resolved_by_name: string | null
  quote: string
  prefix: string
  suffix: string
  block_id: string | null
  start_offset: number
  end_offset: number
  current_start_offset: number | null
  current_end_offset: number | null
  is_detached: boolean
  status: 'open' | 'resolved'
  comments: CommentItem[]
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export type CommentThreadListResponse = {
  items: CommentThread[]
  total: number
}

export type CommentThreadPayload = {
  revision_id: number
  quote: string
  start_offset: number
  end_offset: number
  prefix: string
  suffix: string
  block_id: string | null
  body: string
}

export const commentKeys = {
  all: ['comments'] as const,
  article: (symptomId: number) =>
    [...commentKeys.all, 'article', symptomId] as const,
}

export function listCommentThreads(
  symptomId: number,
  signal?: AbortSignal,
) {
  return apiRequest<CommentThreadListResponse>(
    `/articles/${symptomId}/comments`,
    { signal },
  )
}

export function createCommentThread(
  symptomId: number,
  payload: CommentThreadPayload,
) {
  return apiRequest<CommentThread>(`/articles/${symptomId}/comments`, {
    method: 'POST',
    body: payload,
  })
}

export function replyToCommentThread(threadId: number, body: string) {
  return apiRequest<CommentThread>(`/comments/${threadId}/replies`, {
    method: 'POST',
    body: { body },
  })
}

export function resolveCommentThread(threadId: number) {
  return apiRequest<CommentThread>(`/comments/${threadId}/resolve`, {
    method: 'POST',
  })
}

export function reopenCommentThread(threadId: number) {
  return apiRequest<CommentThread>(`/comments/${threadId}/reopen`, {
    method: 'POST',
  })
}
