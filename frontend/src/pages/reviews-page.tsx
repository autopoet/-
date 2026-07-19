import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  type ReviewQueueItem,
  approveRevision,
  articleKeys,
  listPendingReviews,
  rejectRevision,
} from '../api/articles'
import { useCurrentUser } from '../api/auth'
import { ApiError } from '../api/client'
import { ErrorState, ListSkeleton } from '../components/request-state'
import { RevisionDiff } from '../components/revision-diff'
import styles from './workflow-page.module.css'

function ReviewItem({
  item,
  currentUserId,
}: {
  item: ReviewQueueItem
  currentUserId: number
}) {
  const { revision, base_revision: baseRevision } = item
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const isOwnRevision = revision.author_id === currentUserId
  const decision = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      action === 'approve'
        ? approveRevision(revision.id, note)
        : rejectRevision(revision.id, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: articleKeys.reviews })
      void queryClient.invalidateQueries({
        queryKey: articleKeys.published(revision.symptom_id),
      })
      void queryClient.invalidateQueries({
        queryKey: articleKeys.versions(revision.symptom_id),
      })
    },
  })

  return (
    <li className={styles.reviewItem}>
      <header>
        <div>
          <h2>{revision.title}</h2>
          <p>
            v{revision.version_number} · 修改者 {revision.author_name} · 提交于{' '}
            {new Date(
              revision.submitted_at ?? revision.updated_at,
            ).toLocaleString('zh-CN')}
          </p>
        </div>
        <Link to={`/articles/${revision.symptom_id}`}>查看当前版本</Link>
      </header>
      <RevisionDiff baseRevision={baseRevision} revision={revision} />
      {isOwnRevision ? (
        <p className={styles.reviewGuard} role="note">
          修改者不能审核自己的版本，请由其他审核员处理。
        </p>
      ) : null}
      <label>
        审核意见
        <textarea
          rows={3}
          value={note}
          placeholder="通过时可选；驳回时必填"
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {decision.isError ? (
        <p className={styles.errorText} role="alert">
          {decision.error instanceof ApiError ? decision.error.message : '审核失败'}
        </p>
      ) : null}
      <div className={styles.formActions}>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={decision.isPending || isOwnRevision}
          onClick={() => decision.mutate('reject')}
        >
          驳回
        </button>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={decision.isPending || isOwnRevision}
          onClick={() => decision.mutate('approve')}
        >
          通过并发布
        </button>
      </div>
    </li>
  )
}

export default function ReviewsPage() {
  const currentUser = useCurrentUser()
  const reviews = useQuery({
    queryKey: articleKeys.reviews,
    queryFn: ({ signal }) => listPendingReviews(signal),
    enabled: currentUser.data?.role === 'reviewer',
  })

  if (!currentUser.isPending && currentUser.data?.role !== 'reviewer') {
    return (
      <main id="main-content" className={styles.narrowPage}>
        <h1>审核队列</h1>
        <p>这个页面仅审核员可访问。</p>
      </main>
    )
  }

  return (
    <main id="main-content" className={styles.listPage}>
      <header className={styles.pageTitle}>
        <h1>审核队列</h1>
        <p>通过后立即成为公开版本；驳回必须说明需要修改的内容。</p>
      </header>
      {reviews.isLoading ? <ListSkeleton rows={4} /> : null}
      {reviews.isError ? <ErrorState description="审核队列加载失败。" /> : null}
      {reviews.data?.total === 0 ? <p className={styles.emptyText}>当前没有待审核版本。</p> : null}
      <ul className={styles.reviewList}>
        {reviews.data?.items.map((item) => (
          <ReviewItem
            key={item.revision.id}
            item={item}
            currentUserId={currentUser.data?.id ?? 0}
          />
        ))}
      </ul>
    </main>
  )
}
