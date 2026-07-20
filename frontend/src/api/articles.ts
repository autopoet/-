import { apiRequest } from './client'

export type ArticleDraft = {
  title: string
  summary: string
  applicability: string
  safety: string
  checklist: string[]
  body: string
  edit_summary: string
}

export type ArticleRevision = ArticleDraft & {
  id: number
  symptom_id: number
  author_id: number
  author_name: string
  reviewer_id: number | null
  reviewer_name: string | null
  base_revision_id: number | null
  version_number: number
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'superseded'
  review_note: string
  created_at: string
  updated_at: string
  submitted_at: string | null
  reviewed_at: string | null
  published_at: string | null
}

export type RevisionListResponse = {
  items: ArticleRevision[]
  total: number
}

export type ContributionItem = {
  id: number
  symptom_id: number
  version_number: number
  status: ArticleRevision['status']
  title: string
  edit_summary: string
  updated_at: string
}

export type ContributionOverview = {
  total: number
  published: number
  pending: number
  drafts: number
  recent: ContributionItem[]
}

export type ReviewQueueItem = {
  revision: ArticleRevision
  base_revision: ArticleRevision | null
}

export type ReviewQueueResponse = {
  items: ReviewQueueItem[]
  total: number
}

export const articleKeys = {
  published: (symptomId: number) => ['articles', symptomId, 'published'] as const,
  versions: (symptomId: number) => ['articles', symptomId, 'versions'] as const,
  draft: (symptomId: number) => ['articles', symptomId, 'draft'] as const,
  mine: ['articles', 'mine'] as const,
  overview: ['articles', 'mine', 'overview'] as const,
  reviews: ['reviews'] as const,
}

export function getPublishedArticle(symptomId: number, signal?: AbortSignal) {
  return apiRequest<ArticleRevision>(`/articles/${symptomId}`, { signal })
}

export function listPublishedRevisions(
  symptomId: number,
  signal?: AbortSignal,
) {
  return apiRequest<RevisionListResponse>(
    `/articles/${symptomId}/revisions`,
    { signal },
  )
}

export function getDraft(symptomId: number, signal?: AbortSignal) {
  return apiRequest<ArticleRevision>(`/articles/${symptomId}/draft`, { signal })
}

export function saveDraft(symptomId: number, draft: ArticleDraft) {
  return apiRequest<ArticleRevision>(`/articles/${symptomId}/draft`, {
    method: 'PUT',
    body: draft,
  })
}

export function submitDraft(symptomId: number) {
  return apiRequest<ArticleRevision>(`/articles/${symptomId}/submit`, {
    method: 'POST',
  })
}

export function listMyRevisions(signal?: AbortSignal) {
  return apiRequest<RevisionListResponse>('/articles/mine', { signal })
}

export function getContributionOverview(signal?: AbortSignal) {
  return apiRequest<ContributionOverview>('/articles/mine/overview', { signal })
}

export function listPendingReviews(signal?: AbortSignal) {
  return apiRequest<ReviewQueueResponse>('/reviews', { signal })
}

export function approveRevision(revisionId: number, note: string) {
  return apiRequest<ArticleRevision>(`/reviews/${revisionId}/approve`, {
    method: 'POST',
    body: { note },
  })
}

export function rejectRevision(revisionId: number, note: string) {
  return apiRequest<ArticleRevision>(`/reviews/${revisionId}/reject`, {
    method: 'POST',
    body: { note },
  })
}
