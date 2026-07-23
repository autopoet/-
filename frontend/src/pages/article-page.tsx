import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bookmark,
  ChevronRight,
  MessageSquareText,
  PencilLine,
  ShieldAlert,
} from 'lucide-react'
import {
  type CSSProperties,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  addFavorite,
  articleKeys,
  getFavoriteState,
  getPublishedArticle,
  listPublishedRevisions,
  removeFavorite,
} from '../api/articles'
import { useCurrentUser } from '../api/auth'
import { ApiError } from '../api/client'
import { commentKeys, listCommentThreads } from '../api/comments'
import { getSymptom, symptomKeys } from '../api/symptoms'
import {
  ArticleCommentsPanel,
  type CommentAnchorDraft,
} from '../components/article-comments-panel'
import { InlineArticleEditor } from '../components/inline-article-editor'
import { EmptyState, ErrorState, ListSkeleton } from '../components/request-state'
import {
  RichTextContent,
  type RichTextHighlight,
} from '../components/rich-text-content'
import {
  parseRichTextValue,
  type RichTextDocumentNode,
} from '../lib/rich-text-document'
import styles from './article-page.module.css'

function nodeText(node: RichTextDocumentNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return ' '
  if (node.type === 'inlineFormula') return String(node.attrs?.formula ?? '')
  return (node.content ?? []).map(nodeText).join('')
}

function articleOutline(body: string) {
  const document = parseRichTextValue(body)
  return (document.content ?? []).flatMap((node, index) => {
    if (node.type !== 'heading') return []
    const label = nodeText(node).trim()
    return label ? [{ id: `block-${index}`, label }] : []
  })
}

function useActiveSection(sectionIds: string[]) {
  const [activeSection, setActiveSection] = useState(sectionIds[0] ?? '')

  useEffect(() => {
    setActiveSection(sectionIds[0] ?? '')
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting)
        if (visible?.target.id) setActiveSection(visible.target.id)
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 },
    )
    for (const id of sectionIds) {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    }
    return () => observer.disconnect()
  }, [sectionIds])

  return activeSection
}

function closestBlock(node: Node) {
  const element = node instanceof Element ? node : node.parentElement
  return element?.closest<HTMLElement>('[data-comment-block-id]') ?? null
}

export default function ArticlePage() {
  const { articleId = '' } = useParams()
  const symptomId = Number(articleId)
  const validArticleId = Number.isInteger(symptomId) && symptomId > 0
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const editRequested = searchParams.get('edit') === '1'
  const submitted = searchParams.get('submitted') === '1'
  const commentsDialogRef = useRef<HTMLDialogElement>(null)
  const documentRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const lastCommentTriggerRef = useRef<HTMLElement | null>(null)
  const [readingProgress, setReadingProgress] = useState(0)
  const [selectedAnchor, setSelectedAnchor] = useState<CommentAnchorDraft | null>(
    null,
  )
  const [selectionAction, setSelectionAction] = useState<{
    left: number
    top: number
  } | null>(null)
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null)
  const currentUser = useCurrentUser()

  const symptomQuery = useQuery({
    queryKey: symptomKeys.detail(symptomId),
    queryFn: ({ signal }) => getSymptom(symptomId, signal),
    enabled: validArticleId,
  })
  const publishedQuery = useQuery({
    queryKey: articleKeys.published(symptomId),
    queryFn: ({ signal }) => getPublishedArticle(symptomId, signal),
    enabled: validArticleId,
    retry: false,
  })
  const versionsQuery = useQuery({
    queryKey: articleKeys.versions(symptomId),
    queryFn: ({ signal }) => listPublishedRevisions(symptomId, signal),
    enabled: validArticleId && Boolean(publishedQuery.data),
  })
  const commentsQuery = useQuery({
    queryKey: commentKeys.article(symptomId),
    queryFn: ({ signal }) => listCommentThreads(symptomId, signal),
    enabled: validArticleId && Boolean(publishedQuery.data),
  })
  const favoriteQuery = useQuery({
    queryKey: articleKeys.favorite(symptomId),
    queryFn: ({ signal }) => getFavoriteState(symptomId, signal),
    enabled:
      validArticleId &&
      Boolean(currentUser.data) &&
      Boolean(publishedQuery.data),
  })
  const favoriteMutation = useMutation({
    mutationFn: (favorited: boolean) =>
      favorited ? addFavorite(symptomId) : removeFavorite(symptomId),
    onMutate: async (favorited) => {
      await queryClient.cancelQueries({ queryKey: articleKeys.favorite(symptomId) })
      const previous = queryClient.getQueryData(articleKeys.favorite(symptomId))
      queryClient.setQueryData(articleKeys.favorite(symptomId), { favorited })
      return { previous }
    },
    onError: (_error, _favorited, context) => {
      queryClient.setQueryData(articleKeys.favorite(symptomId), context?.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: articleKeys.favorite(symptomId) })
      void queryClient.invalidateQueries({ queryKey: articleKeys.favorites })
    },
  })

  const outline = useMemo(() => {
    if (!publishedQuery.data) return []
    return [
      { id: 'applicability', label: '适用范围' },
      { id: 'quick-check', label: '快速检查清单' },
      ...articleOutline(publishedQuery.data.body),
    ]
  }, [publishedQuery.data])
  const sectionIds = useMemo(() => outline.map((item) => item.id), [outline])
  const activeSection = useActiveSection(sectionIds)
  const commentHighlights = useMemo<RichTextHighlight[]>(
    () =>
      commentsQuery.data?.items.map((thread) => ({
        id: thread.id,
        quote: thread.quote,
        blockId: thread.block_id,
        startOffset: thread.current_start_offset,
        endOffset: thread.current_end_offset,
        detached: thread.is_detached,
      })) ?? [],
    [commentsQuery.data?.items],
  )

  useEffect(() => {
    let frame = 0
    const updateProgress = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const article = documentRef.current
        if (!article) return
        const rect = article.getBoundingClientRect()
        const scrollable = Math.max(article.offsetHeight - window.innerHeight, 1)
        const current = Math.min(Math.max(-rect.top + 96, 0), scrollable)
        setReadingProgress(Math.round((current / scrollable) * 100))
      })
    }
    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [articleId, editRequested])

  function openComments(event?: MouseEvent<HTMLElement>) {
    if (event) lastCommentTriggerRef.current = event.currentTarget
    commentsDialogRef.current?.showModal()
  }

  function activateThread(threadId: number | null) {
    setActiveThreadId(threadId)
    if (threadId && !commentsDialogRef.current?.open) {
      commentsDialogRef.current?.showModal()
    }
  }

  function captureSelection() {
    window.setTimeout(() => {
      const selection = window.getSelection()
      const body = bodyRef.current
      if (!selection || selection.isCollapsed || !selection.rangeCount || !body) {
        setSelectionAction(null)
        return
      }
      const range = selection.getRangeAt(0)
      if (!body.contains(range.commonAncestorContainer)) {
        setSelectionAction(null)
        return
      }
      const startBlock = closestBlock(range.startContainer)
      const endBlock = closestBlock(range.endContainer)
      if (!startBlock || startBlock !== endBlock) {
        setSelectionAction(null)
        return
      }
      const rawQuote = selection.toString()
      const quote = rawQuote.trim()
      if (!quote || quote.length > 2000) {
        setSelectionAction(null)
        return
      }
      const leadingSpace = rawQuote.length - rawQuote.trimStart().length
      const before = document.createRange()
      before.selectNodeContents(body)
      before.setEnd(range.startContainer, range.startOffset)
      const startOffset = before.toString().length + leadingSpace
      const text = body.textContent ?? ''
      const rect = range.getBoundingClientRect()
      setSelectedAnchor({
        quote,
        startOffset,
        endOffset: startOffset + quote.length,
        prefix: text.slice(Math.max(0, startOffset - 120), startOffset),
        suffix: text.slice(startOffset + quote.length, startOffset + quote.length + 120),
        blockId: startBlock.dataset.commentBlockId ?? null,
      })
      setSelectionAction({
        left: Math.min(Math.max(rect.left + rect.width / 2, 72), window.innerWidth - 72),
        top: Math.max(rect.top - 56, 12),
      })
    }, 0)
  }

  function closeComments() {
    commentsDialogRef.current?.close()
  }

  function startEditing() {
    if (!currentUser.data) {
      navigate(`/login?from=${encodeURIComponent(`/articles/${symptomId}?edit=1`)}`)
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

  function toggleFavorite() {
    if (!currentUser.data) {
      navigate(`/login?from=${encodeURIComponent(`/articles/${symptomId}`)}`)
      return
    }
    favoriteMutation.mutate(!favoriteQuery.data?.favorited)
  }

  if (!validArticleId) {
    return (
      <main id="main-content" className={styles.statePage}>
        <ErrorState title="条目地址无效" description="请返回知识库重新选择一个故障现象。" />
      </main>
    )
  }

  if (symptomQuery.isLoading) {
    return <main id="main-content" className={styles.statePage}><ListSkeleton rows={5} /></main>
  }

  if (symptomQuery.isError && !symptomQuery.data) {
    const notFound = symptomQuery.error instanceof ApiError && symptomQuery.error.status === 404
    return (
      <main id="main-content" className={styles.statePage}>
        <ErrorState
          title={notFound ? '没有找到这个故障条目' : '暂时无法加载条目'}
          description={notFound ? '它可能尚未发布，或者链接中的编号不正确。' : '请检查网络后重新加载。'}
          onRetry={() => void symptomQuery.refetch()}
        />
        <Link className={styles.backLink} to="/explore">返回知识库</Link>
      </main>
    )
  }

  if (!symptomQuery.data) return null

  if (editRequested) {
    if (currentUser.isPending) {
      return <main id="main-content" className={styles.statePage}><ListSkeleton rows={4} /></main>
    }
    if (!currentUser.data) {
      return (
        <main id="main-content" className={styles.statePage}>
          <EmptyState
            title="登录后编辑"
            description="修改内容需要登录并经过审核。"
            action={<Link className={styles.backLink} to={`/login?from=${encodeURIComponent(`/articles/${symptomId}?edit=1`)}`}>前往登录</Link>}
          />
        </main>
      )
    }
    if (publishedQuery.isPending) {
      return <main id="main-content" className={styles.statePage}><ListSkeleton rows={4} /></main>
    }
    if (
      publishedQuery.isError &&
      !(publishedQuery.error instanceof ApiError && publishedQuery.error.status === 404)
    ) {
      return (
        <main id="main-content" className={styles.statePage}>
          <ErrorState
            title="公开版本加载失败"
            description="为避免用旧内容覆盖最新版本，暂时不能进入编辑模式。"
            onRetry={() => void publishedQuery.refetch()}
          />
        </main>
      )
    }
    return (
      <main id="main-content" className={`${styles.page} ${styles.editingPage}`}>
        <aside className={styles.outline}>
          <span className={styles.outlineTitle}>草稿</span>
          <p className={styles.editingHint}>审核通过前不会改变公开版本。</p>
        </aside>
        <article className={styles.document}>
          <div className={styles.breadcrumb}>
            <Link to="/explore">知识库</Link>
            <ChevronRight aria-hidden="true" size={15} />
            <button type="button" onClick={stopEditing}>{symptomQuery.data.name}</button>
            <ChevronRight aria-hidden="true" size={15} />
            <span>编辑</span>
          </div>
          <InlineArticleEditor
            symptomId={symptomId}
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

  if (!publishedQuery.data) {
    return (
      <main id="main-content" className={styles.statePage}>
        {submitted ? (
          <p className={styles.submittedNotice} role="status">
            修改已提交审核；审核通过后会出现在公开知识库。
          </p>
        ) : null}
        <div className={styles.unwrittenHeader}>
          <span>故障现象</span>
          <h1>{symptomQuery.data.name}</h1>
          <p>{symptomQuery.data.description}</p>
        </div>
        <EmptyState
          title="这个主题还没有公开文档"
          description="完成正文并通过审核后会在知识库公开。"
          action={<button className={styles.backLink} type="button" onClick={startEditing}>开始编写</button>}
        />
      </main>
    )
  }

  const published = publishedQuery.data
  const commentCount = commentsQuery.data?.total ?? 0

  return (
    <>
      <main id="main-content" className={styles.page}>
        <aside className={styles.outline} aria-labelledby="outline-title">
          <span id="outline-title" className={styles.outlineTitle}>本文目录</span>
          <nav aria-label="文章目录">
            {outline.map((item, index) => (
              <a key={item.id} className={activeSection === item.id ? styles.outlineActive : undefined} href={`#${item.id}`} aria-current={activeSection === item.id ? 'location' : undefined}>
                <span>{index + 1}</span>{item.label}
              </a>
            ))}
          </nav>
        </aside>

        <article ref={documentRef} className={styles.document} onMouseUp={captureSelection} onKeyUp={captureSelection}>
          {submitted ? <p className={styles.submittedNotice} role="status">修改已提交审核；公开内容会在审核通过后更新。</p> : null}
          <div className={styles.breadcrumb}><Link to="/explore">知识库</Link><ChevronRight aria-hidden="true" size={15} /><span>故障现象</span></div>
          <header className={styles.articleHeader}>
            <div className={styles.headerActions}>
              <button className={styles.favoriteButton} type="button" aria-pressed={favoriteQuery.data?.favorited ?? false} disabled={currentUser.isPending || favoriteMutation.isPending} data-active={favoriteQuery.data?.favorited ? 'true' : 'false'} onClick={toggleFavorite}>
                <Bookmark aria-hidden="true" size={17} />{favoriteQuery.data?.favorited ? '已收藏' : '收藏'}
              </button>
              <button className={styles.editButton} type="button" disabled={currentUser.isPending} onClick={startEditing}><PencilLine aria-hidden="true" size={17} />编辑</button>
              <button className={styles.inlineCommentButton} type="button" aria-controls="comments-dialog" aria-haspopup="dialog" onClick={openComments}>
                <MessageSquareText aria-hidden="true" size={18} />评论 {commentCount}
              </button>
            </div>
            <h1>{published.title}</h1>
            <p className={styles.summary}>{published.summary}</p>
            <div className={styles.metadata}>
              <span>v{published.version_number}</span>
              <span>修改者 {published.author_name}</span>
              <span>审核者 {published.reviewer_name ?? '—'}</span>
              <span>{new Date(published.reviewed_at ?? published.published_at ?? published.updated_at).toLocaleDateString('zh-CN')}</span>
            </div>
            {versionsQuery.data?.items.length ? (
              <details className={styles.versionHistory}>
                <summary>版本历史（{versionsQuery.data.total}）</summary>
                <ol>{versionsQuery.data.items.map((revision) => (
                  <li key={revision.id}>
                    <strong>v{revision.version_number}</strong>
                    <div>
                      <span>{revision.author_name} 修改于 {new Date(revision.submitted_at ?? revision.updated_at).toLocaleString('zh-CN')}</span>
                      <span>{revision.reviewer_name ?? '—'} 审核于 {revision.reviewed_at ? new Date(revision.reviewed_at).toLocaleString('zh-CN') : '—'}</span>
                      {revision.edit_summary ? <p>{revision.edit_summary}</p> : null}
                    </div>
                  </li>
                ))}</ol>
              </details>
            ) : null}
          </header>

          <details className={styles.mobileOutline}><summary>本文目录</summary><nav aria-label="移动端文章目录">{outline.map((item) => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}</nav></details>
          <section id="applicability" className={styles.leadSection}><h2>适用范围</h2><p>{published.applicability}</p></section>
          {published.safety ? <aside className={styles.safety}><ShieldAlert aria-hidden="true" size={20} /><div><strong>安全提示</strong><p>{published.safety}</p></div></aside> : null}
          <section id="quick-check" className={styles.checklistSection}><h2>快速检查清单</h2><div className={styles.checklist}>{published.checklist.map((item) => <label key={item}><input type="checkbox" /><span>{item}</span></label>)}</div></section>
          <div ref={bodyRef} className={styles.articleBody}>
            <RichTextContent value={published.body} highlights={commentHighlights} onHighlightClick={activateThread} />
          </div>
        </article>

        <aside className={styles.progressRail} aria-label={`阅读进度 ${readingProgress}%`} style={{ '--reading-progress': `${readingProgress}%` } as CSSProperties}>
          <span className={styles.progressLabel}>{readingProgress}%</span><span className={styles.progressTrack} aria-hidden="true"><span /></span>
          <button type="button" aria-controls="comments-dialog" aria-haspopup="dialog" onClick={openComments}><MessageSquareText aria-hidden="true" size={19} /><span>评论</span><span className={styles.commentCount}>{commentCount}</span></button>
        </aside>
      </main>

      {selectionAction && selectedAnchor ? (
        <button className={styles.selectionComment} style={{ left: selectionAction.left, top: selectionAction.top }} type="button" onMouseDown={(event) => event.preventDefault()} onClick={(event) => { openComments(event); setSelectionAction(null) }}>
          <MessageSquareText aria-hidden="true" size={17} />评论选中内容
        </button>
      ) : null}

      <dialog id="comments-dialog" ref={commentsDialogRef} className={styles.commentsDialog} aria-labelledby="comments-title" onClose={() => lastCommentTriggerRef.current?.focus()} onClick={(event) => { if (event.target === event.currentTarget) closeComments() }}>
        <ArticleCommentsPanel
          symptomId={symptomId}
          revisionId={published.id}
          currentUser={currentUser.data}
          selectedAnchor={selectedAnchor}
          activeThreadId={activeThreadId}
          onClearSelection={() => { setSelectedAnchor(null); setSelectionAction(null) }}
          onActivateThread={activateThread}
          onClose={closeComments}
        />
      </dialog>
    </>
  )
}
