import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { articleKeys, listMyRevisions } from '../api/articles'
import { useCurrentUser } from '../api/auth'
import { ErrorState, ListSkeleton } from '../components/request-state'
import styles from './workflow-page.module.css'

const statusText = {
  draft: '草稿',
  pending: '待审核',
  approved: '已发布',
  rejected: '未通过',
  superseded: '历史版本',
}

export default function SubmissionsPage() {
  const currentUser = useCurrentUser()
  const revisions = useQuery({
    queryKey: articleKeys.mine,
    queryFn: ({ signal }) => listMyRevisions(signal),
    enabled: Boolean(currentUser.data),
  })

  if (!currentUser.data && !currentUser.isPending) {
    return (
      <main id="main-content" className={styles.narrowPage}>
        <h1>我的提交</h1>
        <Link className={styles.primaryLink} to="/login?from=/submissions">登录后查看</Link>
      </main>
    )
  }

  return (
    <main id="main-content" className={styles.listPage}>
      <header className={styles.pageTitle}>
        <h1>我的提交</h1>
        <p>草稿、待审核版本和审核结果都会保留在这里。</p>
      </header>
      {revisions.isLoading ? <ListSkeleton rows={4} /> : null}
      {revisions.isError ? <ErrorState description="提交记录加载失败。" /> : null}
      {revisions.data?.total === 0 ? <p className={styles.emptyText}>还没有提交记录。</p> : null}
      <ul className={styles.workflowList}>
        {revisions.data?.items.map((revision) => (
          <li key={revision.id}>
            <div>
              <strong>{revision.title}</strong>
              <span>
                v{revision.version_number} · {statusText[revision.status]} · 修改者{' '}
                {revision.author_name} ·{' '}
                {new Date(revision.updated_at).toLocaleString('zh-CN')}
              </span>
              {revision.reviewer_name && revision.reviewed_at ? (
                <p>
                  审核者 {revision.reviewer_name} ·{' '}
                  {new Date(revision.reviewed_at).toLocaleString('zh-CN')}
                </p>
              ) : null}
              {revision.review_note ? <p>审核意见：{revision.review_note}</p> : null}
            </div>
            {revision.status === 'draft' || revision.status === 'rejected' ? (
              <Link to={`/articles/${revision.symptom_id}?edit=1`}>继续编辑</Link>
            ) : (
              <Link to={`/articles/${revision.symptom_id}`}>查看文档</Link>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
