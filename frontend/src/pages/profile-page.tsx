import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Bookmark,
  FilePenLine,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  articleKeys,
  getContributionOverview,
  listFavorites,
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
  const [searchParams] = useSearchParams()
  const activeTab =
    searchParams.get('tab') === 'favorites' ? 'favorites' : 'contributions'
  const overview = useQuery({
    queryKey: articleKeys.overview,
    queryFn: ({ signal }) => getContributionOverview(signal),
    enabled: Boolean(currentUser.data),
  })
  const favorites = useQuery({
    queryKey: articleKeys.favorites,
    queryFn: ({ signal }) => listFavorites(signal),
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

  const initial = currentUser.data.username.slice(0, 1).toLocaleUpperCase()

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.identity}>
        <div className={styles.avatar} aria-hidden="true">
          {initial}
          <i />
        </div>
        <h1>{currentUser.data.username}</h1>
        <div className={styles.identityActions}>
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
      </header>

      <nav className={styles.tabs} aria-label="个人内容">
        <Link
          to="/profile?tab=contributions"
          aria-current={activeTab === 'contributions' ? 'page' : undefined}
        >
          <FilePenLine aria-hidden="true" size={18} />
          贡献
          <strong>{overview.data?.total ?? '…'}</strong>
        </Link>
        <Link
          to="/profile?tab=favorites"
          aria-current={activeTab === 'favorites' ? 'page' : undefined}
        >
          <Bookmark aria-hidden="true" size={18} />
          收藏
          <strong>{favorites.data?.total ?? '…'}</strong>
        </Link>
      </nav>

      {activeTab === 'contributions' ? (
        <section className={styles.content} aria-labelledby="contributions-title">
          <h2 id="contributions-title" className="sr-only">我的贡献</h2>
          {overview.isLoading ? <ListSkeleton rows={4} /> : null}
          {overview.isError ? (
            <ErrorState
              description="个人贡献暂时无法加载。"
              onRetry={() => void overview.refetch()}
            />
          ) : null}
          {overview.data ? (
            <dl className={styles.summary}>
              <div><dt>已发布</dt><dd>{overview.data.published}</dd></div>
              <div><dt>审核中</dt><dd>{overview.data.pending}</dd></div>
              <div><dt>草稿 / 修改</dt><dd>{overview.data.drafts}</dd></div>
            </dl>
          ) : null}
          {overview.data?.recent.length === 0 ? (
            <div className={styles.empty}>
              <p>还没有贡献记录。</p>
              <Link to="/explore">选择一篇文档开始修改</Link>
            </div>
          ) : null}
          {overview.data?.recent.length ? (
            <ol className={styles.list}>
              {overview.data.recent.map((item) => (
                <li key={item.id}>
                  <Link to={`/articles/${item.symptom_id}`}>
                    <span>{statusText[item.status]}</span>
                    <strong>{item.title}</strong>
                    <time dateTime={item.updated_at}>
                      {new Date(item.updated_at).toLocaleDateString('zh-CN')}
                    </time>
                    <ArrowRight aria-hidden="true" size={19} />
                  </Link>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ) : (
        <section className={styles.content} aria-labelledby="favorites-title">
          <h2 id="favorites-title" className="sr-only">我的收藏</h2>
          {favorites.isLoading ? <ListSkeleton rows={4} /> : null}
          {favorites.isError ? (
            <ErrorState
              description="收藏暂时无法加载。"
              onRetry={() => void favorites.refetch()}
            />
          ) : null}
          {favorites.data?.items.length === 0 ? (
            <div className={styles.empty}>
              <p>还没有收藏文档。</p>
              <Link to="/explore">去查 BUG</Link>
            </div>
          ) : null}
          {favorites.data?.items.length ? (
            <ol className={styles.list}>
              {favorites.data.items.map((item) => (
                <li key={item.symptom_id}>
                  <Link to={`/articles/${item.symptom_id}`}>
                    <span>
                      <Bookmark aria-hidden="true" size={15} />
                      收藏
                    </span>
                    <strong>{item.name}</strong>
                    <span>{item.description}</span>
                    <ArrowRight aria-hidden="true" size={19} />
                  </Link>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      )}
    </main>
  )
}
