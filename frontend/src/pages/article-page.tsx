import { useQuery } from '@tanstack/react-query'
import {
  ChevronRight,
  MessageSquareText,
  PencilLine,
  ShieldAlert,
  X,
} from 'lucide-react'
import {
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import {
  articleKeys,
  getPublishedArticle,
  listPublishedRevisions,
} from '../api/articles'
import { useCurrentUser } from '../api/auth'
import { ApiError } from '../api/client'
import { getSymptom, symptomKeys } from '../api/symptoms'
import { InlineArticleEditor } from '../components/inline-article-editor'
import { EmptyState, ErrorState, ListSkeleton } from '../components/request-state'
import {
  type ArticleSection,
  demoArticles,
} from '../content/demo-articles'
import styles from './article-page.module.css'

function parsePublishedBody(body: string): ArticleSection[] {
  const sections: ArticleSection[] = []
  let current: ArticleSection = {
    id: 'published-section-1',
    title: '正文',
    paragraphs: [],
    list: [],
  }

  function finishSection() {
    if (current.paragraphs?.length || current.list?.length) {
      if (!current.paragraphs?.length) current.paragraphs = undefined
      if (!current.list?.length) current.list = undefined
      sections.push(current)
    }
  }

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('## ')) {
      finishSection()
      current = {
        id: `published-section-${sections.length + 1}`,
        title: line.slice(3),
        paragraphs: [],
        list: [],
      }
    } else if (line.startsWith('- ')) {
      current.list?.push(line.slice(2))
    } else {
      current.paragraphs?.push(line)
    }
  }
  finishSection()
  return sections
}

function useActiveSection(sectionIds: string[]) {
  const [activeSection, setActiveSection] = useState(sectionIds[0] ?? '')

  useEffect(() => {
    setActiveSection(sectionIds[0] ?? '')

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting)
        if (visibleEntry?.target.id) {
          setActiveSection(visibleEntry.target.id)
        }
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 },
    )

    for (const id of sectionIds) {
      const section = document.getElementById(id)
      if (section) {
        observer.observe(section)
      }
    }

    return () => observer.disconnect()
  }, [sectionIds])

  return activeSection
}

function WaveformFigure({ kind }: { kind: 'power-drop' | 'serial' }) {
  const isPowerDrop = kind === 'power-drop'
  const title = isPowerDrop ? '负载阶跃时的输出电压波形' : '串行通信波形'
  const description = isPowerDrop
    ? '输出电压在负载接入时短暂下降，随后恢复。'
    : '数字信号在高低电平之间切换，用于检查幅值和时序。'

  return (
    <figure className={styles.waveform}>
      <svg
        viewBox="0 0 640 220"
        role="img"
        aria-labelledby={`waveform-${kind}-title waveform-${kind}-description`}
      >
        <title id={`waveform-${kind}-title`}>{title}</title>
        <desc id={`waveform-${kind}-description`}>{description}</desc>
        <rect className={styles.waveBackground} width="640" height="220" rx="4" />
        <g className={styles.waveGrid} strokeWidth="1">
          {[80, 160, 240, 320, 400, 480, 560].map((x) => (
            <line key={`x-${x}`} x1={x} y1="20" x2={x} y2="190" />
          ))}
          {[50, 90, 130, 170].map((y) => (
            <line key={`y-${y}`} x1="30" y1={y} x2="610" y2={y} />
          ))}
        </g>
        {isPowerDrop ? (
          <>
            <path
              d="M30 78 L220 78 C232 78 236 82 242 122 C250 170 278 112 302 98 C330 82 350 80 385 80 L610 80"
              fill="none"
              className={styles.waveSignal}
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M30 155 L236 155 L242 120 L610 120"
              fill="none"
              className={styles.waveSecondary}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </>
        ) : (
          <path
            d="M30 155 L80 155 L80 55 L145 55 L145 155 L210 155 L210 55 L275 55 L275 155 L340 155 L340 55 L470 55 L470 155 L535 155 L535 55 L610 55"
            fill="none"
            className={styles.waveSignal}
            strokeWidth="4"
            strokeLinejoin="round"
          />
        )}
        <text className={styles.waveLabel} x="34" y="208" fontSize="14">
          时间
        </text>
        <text className={styles.waveLabel} x="570" y="208" fontSize="14">
          2 ms/div
        </text>
      </svg>
      <figcaption>{title}（示意）</figcaption>
    </figure>
  )
}

function ArticleSectionContent({ section }: { section: ArticleSection }) {
  return (
    <section id={section.id} className={styles.articleSection}>
      <h2>{section.title}</h2>
      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {section.list ? (
        <ul>
          {section.list.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {section.code ? (
        <pre tabIndex={0} aria-label={`${section.title}代码示例`}>
          {section.code}
        </pre>
      ) : null}
      {section.table ? (
        <div
          className={styles.tableScroller}
          role="region"
          aria-labelledby={`${section.id}-table-caption`}
          tabIndex={0}
        >
          <table>
            <caption id={`${section.id}-table-caption`}>
              {section.table.caption}
            </caption>
            <thead>
              <tr>
                {section.table.headers.map((header) => (
                  <th key={header} scope="col">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row) => (
                <tr key={row.join('-')}>
                  {row.map((cell) => (
                    <td key={cell}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {section.waveform ? <WaveformFigure kind={section.waveform} /> : null}
      {section.note ? (
        <aside className={styles.note}>
          <strong>排查提示</strong>
          <p>{section.note}</p>
        </aside>
      ) : null}
    </section>
  )
}

export default function ArticlePage() {
  const { articleId = '' } = useParams()
  const numericArticleId = Number(articleId)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const editRequested = searchParams.get('edit') === '1'
  const submitted = searchParams.get('submitted') === '1'
  const validArticleId =
    Number.isInteger(numericArticleId) && numericArticleId > 0
  const commentsDialogRef = useRef<HTMLDialogElement>(null)
  const lastCommentTriggerRef = useRef<HTMLButtonElement | null>(null)
  const currentUser = useCurrentUser()

  const symptomQuery = useQuery({
    queryKey: symptomKeys.detail(numericArticleId),
    queryFn: ({ signal }) => getSymptom(numericArticleId, signal),
    enabled: validArticleId,
  })
  const publishedQuery = useQuery({
    queryKey: articleKeys.published(numericArticleId),
    queryFn: ({ signal }) => getPublishedArticle(numericArticleId, signal),
    enabled: validArticleId,
    retry: false,
  })
  const versionsQuery = useQuery({
    queryKey: articleKeys.versions(numericArticleId),
    queryFn: ({ signal }) =>
      listPublishedRevisions(numericArticleId, signal),
    enabled: validArticleId && Boolean(publishedQuery.data),
  })

  const article = useMemo(
    () =>
      publishedQuery.data
        ? {
            applicability: publishedQuery.data.applicability,
            safety: publishedQuery.data.safety,
            checklist: publishedQuery.data.checklist,
            sections: parsePublishedBody(publishedQuery.data.body),
          }
        : symptomQuery.data
          ? demoArticles[symptomQuery.data.name]
          : undefined,
    [publishedQuery.data, symptomQuery.data],
  )
  const sectionIds = useMemo(
    () =>
      article
        ? ['applicability', 'quick-check', ...article.sections.map(({ id }) => id)]
        : [],
    [article],
  )
  const activeSection = useActiveSection(sectionIds)

  function openComments(event: MouseEvent<HTMLButtonElement>) {
    lastCommentTriggerRef.current = event.currentTarget
    commentsDialogRef.current?.showModal()
  }

  function closeComments() {
    commentsDialogRef.current?.close()
  }

  function startEditing() {
    if (!currentUser.data) {
      const returnTo = `/articles/${numericArticleId}?edit=1`
      navigate(`/login?from=${encodeURIComponent(returnTo)}`)
      return
    }
    const next = new URLSearchParams(searchParams)
    next.set('edit', '1')
    next.delete('submitted')
    setSearchParams(next)
  }

  function stopEditing() {
    const next = new URLSearchParams(searchParams)
    next.delete('edit')
    setSearchParams(next)
  }

  function finishSubmission() {
    const next = new URLSearchParams(searchParams)
    next.delete('edit')
    next.set('submitted', '1')
    setSearchParams(next)
  }

  if (!validArticleId) {
    return (
      <main id="main-content" className={styles.statePage}>
        <ErrorState
          title="条目地址无效"
          description="请返回知识库重新选择一个故障现象。"
        />
      </main>
    )
  }

  if (symptomQuery.isLoading) {
    return (
      <main id="main-content" className={styles.statePage}>
        <ListSkeleton rows={5} />
      </main>
    )
  }

  if (symptomQuery.isError && !symptomQuery.data) {
    const notFound =
      symptomQuery.error instanceof ApiError && symptomQuery.error.status === 404
    return (
      <main id="main-content" className={styles.statePage}>
        <ErrorState
          title={notFound ? '没有找到这个故障条目' : '暂时无法加载条目'}
          description={
            notFound
              ? '它可能已经被移除，或者链接中的编号不正确。'
              : '请保留当前页面，检查网络后重新加载。'
          }
          onRetry={() => void symptomQuery.refetch()}
        />
        <Link className={styles.backLink} to="/explore">
          返回知识库
        </Link>
      </main>
    )
  }

  if (!symptomQuery.data) {
    return null
  }

  if (editRequested) {
    if (currentUser.isPending) {
      return (
        <main id="main-content" className={styles.statePage}>
          <ListSkeleton rows={4} />
        </main>
      )
    }

    if (!currentUser.data) {
      const returnTo = `/articles/${numericArticleId}?edit=1`
      return (
        <main id="main-content" className={styles.statePage}>
          <EmptyState
            title="登录后编辑"
            description="公开内容可以直接阅读，修改内容需要登录并经过审核。"
            action={
              <Link
                className={styles.backLink}
                to={`/login?from=${encodeURIComponent(returnTo)}`}
              >
                前往登录
              </Link>
            }
          />
        </main>
      )
    }

    return (
      <main id="main-content" className={`${styles.page} ${styles.editingPage}`}>
        <aside className={styles.outline}>
          <span className={styles.outlineTitle}>当前状态</span>
          <p className={styles.editingHint}>
            修改会先保存为草稿，提交并审核通过后才会替换公开版本。
          </p>
        </aside>
        <article className={styles.document}>
          <div className={styles.breadcrumb}>
            <Link to="/explore">知识库</Link>
            <ChevronRight aria-hidden="true" size={15} />
            <button type="button" onClick={stopEditing}>
              {symptomQuery.data.name}
            </button>
            <ChevronRight aria-hidden="true" size={15} />
            <span>编辑</span>
          </div>
          <InlineArticleEditor
            symptomId={numericArticleId}
            symptomName={symptomQuery.data.name}
            symptomDescription={symptomQuery.data.description}
            publishedRevision={publishedQuery.data}
            onCancel={stopEditing}
            onSubmitted={finishSubmission}
          />
        </article>
      </main>
    )
  }

  if (!article) {
    return (
      <main id="main-content" className={styles.statePage}>
        <div className={styles.unwrittenHeader}>
          <span>故障现象</span>
          <h1>{symptomQuery.data.name}</h1>
          <p>{symptomQuery.data.description}</p>
        </div>
        <EmptyState
          title="这个主题还没有完整排查文档"
          description="故障现象已经收录，正文将在贡献和审核流程完成后公开。"
          action={
            <button className={styles.backLink} type="button" onClick={startEditing}>
              开始编写
            </button>
          }
        />
      </main>
    )
  }

  const outline = [
    { id: 'applicability', label: '适用范围' },
    { id: 'quick-check', label: '快速检查清单' },
    ...article.sections.map((section) => ({
      id: section.id,
      label: section.title,
    })),
  ]

  return (
    <>
      <main id="main-content" className={styles.page}>
        <aside className={styles.outline} aria-labelledby="outline-title">
          <span id="outline-title" className={styles.outlineTitle}>
            本文目录
          </span>
          <nav aria-label="文章目录">
            {outline.map((item, index) => (
              <a
                key={item.id}
                className={
                  activeSection === item.id ? styles.outlineActive : undefined
                }
                href={`#${item.id}`}
                aria-current={
                  activeSection === item.id ? 'location' : undefined
                }
              >
                <span>{index + 1}</span>
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className={styles.document}>
          {submitted ? (
            <p className={styles.submittedNotice} role="status">
              修改已提交审核；公开内容会在审核通过后更新。
            </p>
          ) : null}
          <div className={styles.breadcrumb}>
            <Link to="/explore">知识库</Link>
            <ChevronRight aria-hidden="true" size={15} />
            <span>故障现象</span>
          </div>

          <header className={styles.articleHeader}>
            <div className={styles.headerActions}>
              <button
                className={styles.editButton}
                type="button"
                disabled={currentUser.isPending}
                onClick={startEditing}
              >
                <PencilLine aria-hidden="true" size={17} />
                编辑
              </button>
              <button
                className={styles.inlineCommentButton}
                type="button"
                aria-controls="comments-dialog"
                aria-haspopup="dialog"
                onClick={openComments}
              >
                <MessageSquareText aria-hidden="true" size={18} />
                评论 0
              </button>
            </div>
            <h1>{publishedQuery.data?.title ?? symptomQuery.data.name}</h1>
            <p className={styles.summary}>
              {publishedQuery.data?.summary ?? symptomQuery.data.description}
            </p>
            {publishedQuery.data ? (
              <>
                <div className={styles.metadata}>
                  <span>v{publishedQuery.data.version_number}</span>
                  <span>修改者 {publishedQuery.data.author_name}</span>
                  <span>
                    审核者 {publishedQuery.data.reviewer_name ?? '—'}
                  </span>
                  <span>
                    {new Date(
                      publishedQuery.data.reviewed_at ??
                        publishedQuery.data.published_at ??
                        publishedQuery.data.updated_at,
                    ).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                {versionsQuery.data?.items.length ? (
                  <details className={styles.versionHistory}>
                    <summary>
                      版本历史（{versionsQuery.data.total}）
                    </summary>
                    <ol>
                      {versionsQuery.data.items.map((revision) => (
                        <li key={revision.id}>
                          <strong>v{revision.version_number}</strong>
                          <div>
                            <span>
                              {revision.author_name} 修改于{' '}
                              {new Date(
                                revision.submitted_at ?? revision.updated_at,
                              ).toLocaleString('zh-CN')}
                            </span>
                            <span>
                              {revision.reviewer_name ?? '—'} 审核于{' '}
                              {revision.reviewed_at
                                ? new Date(
                                    revision.reviewed_at,
                                  ).toLocaleString('zh-CN')
                                : '—'}
                            </span>
                            {revision.edit_summary ? (
                              <p>{revision.edit_summary}</p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
              </>
            ) : null}
          </header>

          <details className={styles.mobileOutline}>
            <summary>本文目录</summary>
            <nav aria-label="移动端文章目录">
              {outline.map((item) => (
                <a key={item.id} href={`#${item.id}`}>
                  {item.label}
                </a>
              ))}
            </nav>
          </details>

          <section id="applicability" className={styles.leadSection}>
            <h2>适用范围</h2>
            <p>{article.applicability}</p>
          </section>

          {article.safety ? (
            <aside className={styles.safety}>
              <ShieldAlert aria-hidden="true" size={20} />
              <div>
                <strong>安全提示</strong>
                <p>{article.safety}</p>
              </div>
            </aside>
          ) : null}

          <section id="quick-check" className={styles.checklistSection}>
            <h2>快速检查清单</h2>
            <div className={styles.checklist}>
              {article.checklist.map((item) => (
                <label key={item}>
                  <input type="checkbox" />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </section>

          <div className={styles.articleBody}>
            {article.sections.map((section) => (
              <ArticleSectionContent key={section.id} section={section} />
            ))}
          </div>

        </article>

        <aside className={styles.commentRail} aria-label="评论入口">
          <button
            type="button"
            aria-controls="comments-dialog"
            aria-haspopup="dialog"
            onClick={openComments}
          >
            <MessageSquareText aria-hidden="true" size={19} />
            <span>评论</span>
            <span className={styles.commentCount}>0</span>
          </button>
        </aside>
      </main>

      <dialog
        id="comments-dialog"
        ref={commentsDialogRef}
        className={styles.commentsDialog}
        aria-labelledby="comments-title"
        onClose={() => lastCommentTriggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeComments()
          }
        }}
      >
        <div className={styles.commentsPanel}>
          <header>
            <div>
              <span>文档讨论</span>
              <h2 id="comments-title">评论</h2>
            </div>
            <button
              type="button"
              aria-label="关闭评论"
              onClick={closeComments}
            >
              <X aria-hidden="true" size={20} />
            </button>
          </header>
          <div className={styles.commentsEmpty}>
            <MessageSquareText aria-hidden="true" size={28} />
            <h3>这里还没有讨论</h3>
            <p>登录后可选中正文中的一段文字发起评论。</p>
          </div>
        </div>
      </dialog>
    </>
  )
}
