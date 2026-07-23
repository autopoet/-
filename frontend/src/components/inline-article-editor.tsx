import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import {
  type FormEvent,
  lazy,
  Suspense,
  useEffect,
  useState,
} from 'react'
import {
  type ArticleDraft,
  type ArticleRevision,
  articleKeys,
  getDraft,
  saveDraft,
  submitDraft,
} from '../api/articles'
import { ApiError } from '../api/client'
import { useCurrentUser } from '../api/auth'
import { uploadImage } from '../api/uploads'
import { demoArticles } from '../content/demo-articles'
import styles from './inline-article-editor.module.css'

const RichTextEditor = lazy(() =>
  import('./rich-text-editor').then((module) => ({
    default: module.RichTextEditor,
  })),
)

const emptyDraft: ArticleDraft = {
  title: '',
  summary: '',
  applicability: '',
  safety: '',
  checklist: [''],
  body: '',
  edit_summary: '',
}

function demoDraft(name: string, description: string): ArticleDraft {
  const demo = demoArticles[name]
  const sections = demo?.sections ?? []
  return {
    title: name,
    summary: description,
    applicability: demo?.applicability ?? '',
    safety: demo?.safety ?? '',
    checklist: demo?.checklist ?? [''],
    body: sections
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
      .join('\n\n'),
    edit_summary: '',
  }
}

export function InlineArticleEditor({
  symptomId,
  symptomName,
  symptomDescription,
  publishedRevision,
  onCancel,
  onSubmitted,
}: {
  symptomId: number
  symptomName: string
  symptomDescription: string
  publishedRevision?: ArticleRevision
  onCancel: () => void
  onSubmitted: () => void
}) {
  const queryClient = useQueryClient()
  const currentUser = useCurrentUser()
  const [draft, setDraft] = useState<ArticleDraft>(emptyDraft)
  const [initialized, setInitialized] = useState(false)
  const [localError, setLocalError] = useState('')
  const draftQuery = useQuery({
    queryKey: articleKeys.draft(symptomId),
    queryFn: ({ signal }) => getDraft(symptomId, signal),
    retry: false,
  })
  const draftMissing =
    draftQuery.error instanceof ApiError && draftQuery.error.status === 404
  const draftFailed = draftQuery.isError && !draftMissing
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
      void queryClient.invalidateQueries({ queryKey: articleKeys.reviews })
      onSubmitted()
    },
  })

  useEffect(() => {
    if (initialized || draftQuery.isPending || draftFailed) return
    const source =
      draftQuery.data ??
      publishedRevision ??
      demoDraft(symptomName, symptomDescription)
    setDraft({
      title: source.title,
      summary: source.summary,
      applicability: source.applicability,
      safety: source.safety,
      checklist: source.checklist.length ? source.checklist : [''],
      body: source.body,
      edit_summary: source.edit_summary ?? '',
    })
    setInitialized(true)
  }, [
    draftQuery.data,
    draftFailed,
    draftQuery.isPending,
    initialized,
    publishedRevision,
    symptomDescription,
    symptomName,
  ])

  function updateField<Key extends keyof ArticleDraft>(
    key: Key,
    value: ArticleDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError('')
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null
    const isSubmitting = submitter?.value === 'submit'
    if (isSubmitting && !draft.edit_summary.trim()) {
      setLocalError('提交审核前请填写修改说明。')
      return
    }

    const payload = {
      ...draft,
      checklist: draft.checklist.map((item) => item.trim()).filter(Boolean),
    }
    await saveMutation.mutateAsync(payload)
    if (isSubmitting) await submitMutation.mutateAsync()
  }

  if (draftFailed) {
    return (
      <div>
        <p className={styles.error} role="alert">
          草稿加载失败。为避免覆盖已有内容，编辑器没有创建临时副本。
        </p>
        <button
          className={styles.addButton}
          type="button"
          onClick={() => void draftQuery.refetch()}
        >
          重新加载草稿
        </button>
      </div>
    )
  }

  if (!initialized) {
    return <p className={styles.loading}>正在准备当前文档的编辑内容…</p>
  }

  if (draftQuery.data?.status === 'pending') {
    return (
      <section className={styles.editor}>
        <header className={styles.modeHeader}>
          <div>
            <strong>修改正在审核</strong>
            <span>审核完成前不能继续覆盖这份版本。</span>
          </div>
          <button type="button" onClick={onCancel}>
            <X aria-hidden="true" size={17} />
            返回文档
          </button>
        </header>
      </section>
    )
  }

  const mutationError = saveMutation.error ?? submitMutation.error

  return (
    <form className={styles.editor} onSubmit={handleSubmit}>
      <header className={styles.modeHeader}>
        <div>
          <strong>编辑模式</strong>
          <span>你看到的位置就是发布后的位置</span>
        </div>
        <button type="button" onClick={onCancel}>
          <X aria-hidden="true" size={17} />
          退出编辑
        </button>
      </header>

      {draftQuery.data?.status === 'rejected' ? (
        <aside className={styles.rejection}>
          <strong>上次审核未通过</strong>
          <span>{draftQuery.data.review_note}</span>
        </aside>
      ) : null}

      <label className={styles.titleField}>
        <span>标题</span>
        <input
          required
          minLength={2}
          maxLength={100}
          value={draft.title}
          onChange={(event) => updateField('title', event.target.value)}
        />
      </label>

      <label className={styles.summaryField}>
        <span>摘要</span>
        <textarea
          required
          rows={2}
          maxLength={500}
          value={draft.summary}
          onChange={(event) => updateField('summary', event.target.value)}
        />
      </label>

      <section className={styles.editSection}>
        <h2>适用范围</h2>
        <textarea
          aria-label="适用范围"
          required
          rows={3}
          value={draft.applicability}
          onChange={(event) => updateField('applicability', event.target.value)}
        />
      </section>

      <section className={styles.editSection}>
        <h2>安全提示</h2>
        <textarea
          aria-label="安全提示"
          rows={3}
          value={draft.safety}
          onChange={(event) => updateField('safety', event.target.value)}
        />
      </section>

      <section className={styles.editSection}>
        <h2>快速检查清单</h2>
        <div className={styles.checklistEditor}>
          {draft.checklist.map((item, index) => (
            <div key={index}>
              <input
                aria-label={`检查项 ${index + 1}`}
                required
                maxLength={200}
                value={item}
                onChange={(event) => {
                  const checklist = [...draft.checklist]
                  checklist[index] = event.target.value
                  updateField('checklist', checklist)
                }}
              />
              <button
                type="button"
                aria-label={`删除检查项 ${index + 1}`}
                disabled={draft.checklist.length === 1}
                onClick={() =>
                  updateField(
                    'checklist',
                    draft.checklist.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          className={styles.addButton}
          type="button"
          onClick={() => updateField('checklist', [...draft.checklist, ''])}
        >
          <Plus aria-hidden="true" size={16} />
          添加检查项
        </button>
      </section>

      <section className={styles.richTextSection}>
        <h2>排查正文</h2>
        <Suspense fallback={<p className={styles.loading}>正在加载正文编辑器…</p>}>
          <RichTextEditor
            value={draft.body}
            onChange={(body) => updateField('body', body)}
            autoSaveKey={`${currentUser.data?.id ?? 'user'}:${symptomId}:${draftQuery.data?.base_revision_id ?? 0}`}
            placeholder="按排查顺序写下测量方法、预期结果、可能原因与修复验证…"
            onUploadImage={async (file) => (await uploadImage(file)).url}
          />
        </Suspense>
      </section>

      <label className={styles.editSummary}>
        <span>修改说明</span>
        <textarea
          rows={2}
          maxLength={500}
          placeholder="简要说明改了什么，以及为什么修改"
          value={draft.edit_summary}
          onChange={(event) => updateField('edit_summary', event.target.value)}
        />
      </label>

      {localError || mutationError ? (
        <p className={styles.error} role="alert">
          {localError ||
            (mutationError instanceof ApiError
              ? mutationError.message
              : '保存失败，请重试')}
        </p>
      ) : null}
      {saveMutation.isSuccess && !submitMutation.isPending ? (
        <p className={styles.success} role="status">
          草稿已保存
        </p>
      ) : null}

      <footer className={styles.actions}>
        <button type="button" onClick={onCancel}>
          取消
        </button>
        <button
          type="submit"
          value="save"
          disabled={saveMutation.isPending || submitMutation.isPending}
        >
          保存草稿
        </button>
        <button
          className={styles.primary}
          type="submit"
          value="submit"
          disabled={saveMutation.isPending || submitMutation.isPending}
        >
          提交审核
        </button>
      </footer>
    </form>
  )
}
