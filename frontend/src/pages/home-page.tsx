import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Bookmark,
  BookOpenText,
  ChevronDown,
  FilePenLine,
  LogIn,
  UserPlus,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  articleKeys,
  getContributionOverview,
  listFavorites,
} from '../api/articles'
import { useCurrentUser } from '../api/auth'
import { listSymptoms, symptomKeys } from '../api/symptoms'
import { SearchForm } from '../components/search-form'
import styles from './home-page.module.css'

export default function HomePage() {
  const currentUser = useCurrentUser()
  const symptoms = useQuery({
    queryKey: symptomKeys.list(),
    queryFn: ({ signal }) => listSymptoms(undefined, signal),
  })
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

  const username = currentUser.data?.username
  const initial = username?.slice(0, 1).toLocaleUpperCase()

  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.atmosphere} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className={styles.identity} data-authenticated={Boolean(username)}>
          <div className={styles.avatar} aria-hidden="true">
            {initial ? (
              <span>{initial}</span>
            ) : (
              <BookOpenText size={34} strokeWidth={1.35} />
            )}
            <i />
          </div>

          <h1 id="home-title">{username ?? '电赛白皮书'}</h1>

          <div className={styles.identityRule} aria-hidden="true" />

          {username ? (
            <nav className={styles.accountLinks} aria-label="我的知识库">
              <Link to="/profile?tab=contributions">
                <FilePenLine aria-hidden="true" size={18} />
                <span>贡献</span>
                <strong>{overview.data?.total ?? '…'}</strong>
              </Link>
              <Link to="/profile?tab=favorites">
                <Bookmark aria-hidden="true" size={18} />
                <span>收藏</span>
                <strong>{favorites.data?.total ?? '…'}</strong>
              </Link>
            </nav>
          ) : (
            <nav className={styles.accountLinks} aria-label="账号入口">
              <Link to="/login?mode=login">
                <LogIn aria-hidden="true" size={18} />
                <span>登录</span>
              </Link>
              <Link to="/login?mode=register">
                <UserPlus aria-hidden="true" size={18} />
                <span>注册</span>
              </Link>
            </nav>
          )}
        </div>

        <div className={styles.searchStage}>
          <SearchForm variant="hero" />
        </div>

        <a className={styles.scrollCue} href="#documents">
          <BookOpenText aria-hidden="true" size={21} />
          <span>故障文档</span>
          <ChevronDown aria-hidden="true" size={17} />
        </a>
      </section>

      <section id="documents" className={styles.documents} aria-labelledby="documents-title">
        <header className={styles.documentsHeader}>
          <h2 id="documents-title">故障文档</h2>
          <Link to="/explore">
            全部文档
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </header>

        {symptoms.isLoading ? (
          <p className={styles.loadingText}>正在读取文档…</p>
        ) : null}
        {symptoms.isError ? (
          <p className={styles.loadingText}>文档暂时无法加载，请稍后重试。</p>
        ) : null}
        {symptoms.data ? (
          <ol className={styles.documentList}>
            {symptoms.data.items.slice(0, 8).map((symptom, index) => (
              <li key={symptom.id}>
                <Link to={`/articles/${symptom.id}`}>
                  <span className={styles.documentIndex}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.documentCopy}>
                    <strong>{symptom.name}</strong>
                    <span>{symptom.description}</span>
                  </span>
                  <ArrowRight aria-hidden="true" size={20} />
                </Link>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </main>
  )
}
