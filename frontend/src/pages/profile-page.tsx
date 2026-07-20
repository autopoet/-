import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  articleKeys,
  getContributionOverview,
  type ContributionItem,
} from '../api/articles'
import { authKeys, logout, useCurrentUser } from '../api/auth'
import { ErrorState, ListSkeleton } from '../components/request-state'
import styles from './profile-page.module.css'

const statusText: Record<ContributionItem['status'], string> = {
  draft: '草稿',
  pending: '审核中',
  approved: '已发布',
  rejected: '需修改',
  superseded: '历史版本',
}

export default function ProfilePage() {
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const overview = useQuery({
    queryKey: articleKeys.overview,
    queryFn: ({ signal }) => getContributionOverview(signal),
    enabled: Boolean(currentUser.data),
  })
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(authKeys.currentUser, null)
      navigate('/')
    },
  })

  if (!currentUser.isPending && !currentUser.data) {
    return <Navigate replace to="/login?from=/profile" />
  }

  if (currentUser.isPending) {
    return (
      <main id="main-content" className={styles.page}>
        <ListSkeleton rows={4} />
      </main>
    )
  }

  if (!currentUser.data) return null

  const selected =
    overview.data?.recent.find((item) => item.id === selectedId) ??
    overview.data?.recent[0]
  const initial = currentUser.data.username.slice(0, 1).toLocaleUpperCase()

  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.identity} aria-labelledby="profile-title">
        <div className={styles.avatar} aria-hidden="true">
          <span>{initial}</span>
        </div>
        <div>
          <p className={styles.eyebrow}>
            <UserRound aria-hidden="true" size={16} />
            {currentUser.data.role === 'reviewer' ? '审核员' : '贡献者'}
          </p>
          <h1 id="profile-title">{currentUser.data.username}</h1>
        </div>

        {overview.data ? (
          <dl className={styles.counts}>
            <div>
              <dt>贡献</dt>
              <dd>{overview.data.total}</dd>
            </div>
            <div>
              <dt>已发布</dt>
              <dd>{overview.data.published}</dd>
            </div>
            <div>
              <dt>审核中</dt>
              <dd>{overview.data.pending}</dd>
            </div>
            <div>
              <dt>草稿 / 修改</dt>
              <dd>{overview.data.drafts}</dd>
            </div>
          </dl>
        ) : null}

        <div className={styles.accountActions}>
          {currentUser.data.role === 'reviewer' ? (
            <Link to="/reviews">
              <ShieldCheck aria-hidden="true" size={17} />
              审核队列
            </Link>
          ) : null}
          <button
            type="button"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut aria-hidden="true" size={17} />
            退出登录
          </button>
        </div>
      </section>

      <section className={styles.activity} aria-labelledby="activity-title">
        <header>
          <h2 id="activity-title">最近贡献</h2>
        </header>

        {overview.isLoading ? <ListSkeleton rows={4} /> : null}
        {overview.isError ? (
          <ErrorState
            description="个人贡献暂时无法加载。"
            onRetry={() => void overview.refetch()}
          />
        ) : null}
        {overview.data?.recent.length === 0 ? (
          <div className={styles.empty}>
            <p>这里还没有贡献记录。</p>
            <Link to="/explore">去查 BUG</Link>
          </div>
        ) : null}
        {overview.data?.recent.length ? (
          <div className={styles.traceLayout}>
            <ol className={styles.trace}>
              {overview.data.recent.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={selected?.id === item.id}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className={styles.traceDot} />
                    <span>
                      <strong>{item.title}</strong>
                      <small>
                        {statusText[item.status]} ·{' '}
                        {new Date(item.updated_at).toLocaleDateString('zh-CN')}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            {selected ? (
              <aside className={styles.inspector} aria-live="polite">
                <span>{statusText[selected.status]}</span>
                <h3>{selected.title}</h3>
                <p>{selected.edit_summary || '这次修改没有填写额外说明。'}</p>
                <dl>
                  <div>
                    <dt>版本</dt>
                    <dd>v{selected.version_number}</dd>
                  </div>
                  <div>
                    <dt>更新</dt>
                    <dd>{new Date(selected.updated_at).toLocaleString('zh-CN')}</dd>
                  </div>
                </dl>
                <Link to={`/articles/${selected.symptom_id}`}>
                  查看文档
                  <ArrowUpRight aria-hidden="true" size={17} />
                </Link>
              </aside>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  )
}
