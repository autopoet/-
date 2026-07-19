import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  type ArticleDraft,
  articleKeys,
  getDraft,
  getPublishedArticle,
  saveDraft,
  submitDraft,
} from '../api/articles'
import { useCurrentUser } from '../api/auth'
import { ApiError } from '../api/client'
import { getSymptom, symptomKeys } from '../api/symptoms'
import { demoArticles } from '../content/demo-articles'
import styles from './workflow-page.module.css'

const emptyDraft: ArticleDraft = {
  title: '',
  summary: '',
  applicability: '',
  safety: '',
  checklist: [],
  body: '',
}

function demoBody(name: string) {
  return (demoArticles[name]?.sections ?? [])
    .map((section) =>
      [
        `## ${section.title}`,
        ...(section.paragraphs ?? []),
        ...(section.list ?? []).map((item) => `- ${item}`),
        section.note ? `提示：${section.note}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    )
    .join('\n\n')
}

export default function EditorPage() {
  const { articleId = '' } = useParams()
  const symptomId = Number(articleId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUser = useCurrentUser()
  const [draft, setDraft] = useState<ArticleDraft>(emptyDraft)
  const [initialized, setInitialized] = useState(false)
  const symptomQuery = useQuery({
    queryKey: symptomKeys.detail(symptomId),
    queryFn: ({ signal }) => getSymptom(symptomId, signal),
    enabled: Number.isInteger(symptomId) && symptomId > 0,
  })
  const draftQuery = useQuery({
    queryKey: articleKeys.draft(symptomId),
    queryFn: ({ signal }) => getDraft(symptomId, signal),
    enabled: Boolean(currentUser.data),
    retry: false,
  })
  const publishedQuery = useQuery({
    queryKey: articleKeys.published(symptomId),
    queryFn: ({ signal }) => getPublishedArticle(symptomId, signal),
    enabled: Boolean(currentUser.data),
    retry: false,
  })
  const saveMutation = useMutation({
    mutationFn: (payload: ArticleDraft) => saveDraft(symptomId, payload),
    onSuccess: (revision) => {
      queryClient.setQueryData(articleKeys.draft(symptomId), revision)
      void queryClient.invalidateQueries({ queryKey: articleKeys.mine })
    },
  })
  const submitMutation = useMutation({
    mutationFn: () => submitDraft(symptomId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: articleKeys.mine })
      navigate('/submissions')
    },
  })

  useEffect(() => {
    if (initialized || !symptomQuery.data || !currentUser.data) return
    if (draftQuery.isPending || publishedQuery.isPending) return

    const source = draftQuery.data ?? publishedQuery.data
    const demo = demoArticles[symptomQuery.data.name]
    setDraft(
      source ?? {
        title: symptomQuery.data.name,
        summary: symptomQuery.data.description,
        applicability: demo?.applicability ?? '',
        safety: demo?.safety ?? '',
        checklist: demo?.checklist ?? [''],
        body: demoBody(symptomQuery.data.name),
      },
    )
    setInitialized(true)
  }, [
    currentUser.data,
    draftQuery.data,
    draftQuery.isPending,
    initialized,
    publishedQuery.data,
    publishedQuery.isPending,
    symptomQuery.data,
  ])

  if (currentUser.isPending) {
    return <main id="main-content" className={styles.narrowPage}>正在确认登录状态…</main>
  }

  if (!currentUser.data) {
    return (
      <main id="main-content" className={styles.narrowPage}>
        <header className={styles.pageTitle}>
          <h1>登录后编辑</h1>
          <p>公开内容可以直接阅读，修改内容需要登录并经过审核。</p>
        </header>
        <Link className={styles.primaryLink} to={`/login?from=/articles/${symptomId}/edit`}>
          前往登录
        </Link>
      </main>
    )
  }

  if (symptomQuery.isError) {
    return (
      <main id="main-content" className={styles.narrowPage}>
        <h1>无法打开编辑器</h1>
        <p>故障条目不存在或暂时无法加载。</p>
      </main>
    )
  }

  if (!initialized) {
    return (
      <main id="main-content" className={styles.narrowPage}>
        正在准备编辑器…
      </main>
    )
  }

  function updateField<Key extends keyof ArticleDraft>(
    key: Key,
    value: ArticleDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null
    const normalizedDraft = {
      ...draft,
      checklist: draft.checklist.map((item) => item.trim()).filter(Boolean),
    }
    await saveMutation.mutateAsync(normalizedDraft)
    if (submitter?.value === 'submit') {
      await submitMutation.mutateAsync()
    }
  }

  const mutationError = saveMutation.error ?? submitMutation.error

  return (
    <main id="main-content" className={styles.editorPage}>
      <header className={styles.editorHeader}>
        <div>
          <Link to={`/articles/${symptomId}`}>← 返回文档</Link>
          <h1>编辑文档</h1>
          <p>保存只会更新你的草稿；提交审核后才会进入审核队列。</p>
        </div>
        {draftQuery.data?.status === 'rejected' ? (
          <div className={styles.rejection}>
            <strong>上次审核未通过</strong>
            <span>{draftQuery.data.review_note}</span>
          </div>
        ) : null}
      </header>

      <form className={styles.editorForm} onSubmit={handleSubmit}>
        <label>
          标题
          <input
            required
            minLength={2}
            maxLength={100}
            value={draft.title}
            onChange={(event) => updateField('title', event.target.value)}
          />
        </label>
        <label>
          摘要
          <textarea
            required
            rows={2}
            maxLength={500}
            value={draft.summary}
            onChange={(event) => updateField('summary', event.target.value)}
          />
        </label>
        <label>
          适用范围
          <textarea
            required
            rows={3}
            value={draft.applicability}
            onChange={(event) => updateField('applicability', event.target.value)}
          />
        </label>
        <label>
          安全提示
          <textarea
            rows={3}
            value={draft.safety}
            onChange={(event) => updateField('safety', event.target.value)}
          />
        </label>
        <label>
          快速检查清单
          <span className={styles.fieldHint}>每行一项</span>
          <textarea
            required
            rows={5}
            value={draft.checklist.join('\n')}
            onChange={(event) =>
              updateField(
                'checklist',
                event.target.value.split('\n'),
              )
            }
          />
        </label>
        <label>
          正文
          <span className={styles.fieldHint}>普通段落直接输入；用“##”开始小标题，用“-”开始列表项</span>
          <textarea
            required
            className={styles.bodyEditor}
            value={draft.body}
            onChange={(event) => updateField('body', event.target.value)}
          />
        </label>

        {mutationError ? (
          <p className={styles.errorText} role="alert">
            {mutationError instanceof ApiError ? mutationError.message : '保存失败，请重试'}
          </p>
        ) : null}
        {saveMutation.isSuccess && !submitMutation.isPending ? (
          <p className={styles.successText} role="status">草稿已保存</p>
        ) : null}

        <div className={styles.formActions}>
          <button
            className={styles.secondaryButton}
            type="submit"
            value="save"
            disabled={saveMutation.isPending || submitMutation.isPending}
          >
            保存草稿
          </button>
          <button
            className={styles.primaryButton}
            type="submit"
            value="submit"
            disabled={saveMutation.isPending || submitMutation.isPending}
          >
            提交审核
          </button>
        </div>
      </form>
    </main>
  )
}
