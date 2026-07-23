import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FileStack,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react'
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
  deleteDraft,
  getDraft,
  publishOfficialSeed,
  saveDraft,
  submitDraft,
  withdrawRevision,
} from '../api/articles'
import { ApiError } from '../api/client'
import { useCurrentUser } from '../api/auth'
import { notificationKeys } from '../api/notifications'
import { uploadImage } from '../api/uploads'
import {
  insertTroubleshootingTemplate,
  missingDraftSections,
  richTextPlainText,
} from '../lib/troubleshooting-template'
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

export function InlineArticleEditor({
  symptomId,
  symptomName,
  symptomDescription,
  publishedRevision,
  onCancel,
  onSubmitted,
  onPublished,
  onDeleted,
}: {
  symptomId: number
  symptomName: string
  symptomDescription: string
  publishedRevision?: ArticleRevision
  onCancel: () => void
  onSubmitted: () => void
  onPublished: () => void
  onDeleted: () => void
}) {
  const queryClient = useQueryClient()
  const currentUser = useCurrentUser()
  const [draft, setDraft] = useState<ArticleDraft>(emptyDraft)
  const [initialized, setInitialized] = useState(false)
  const [localError, setLocalError] = useState('')
  const [confirmAction, setConfirmAction] = useState<
    'submit' | 'official' | null
  >(null)
  const [missingSections, setMissingSections] = useState<string[]>([])
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
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
      onSubmitted()
    },
  })
  const withdrawMutation = useMutation({
    mutationFn: () => withdrawRevision(symptomId),
    onSuccess: (revision) => {
      queryClient.setQueryData(articleKeys.draft(symptomId), revision)
      setDraft({
        title: revision.title,
        summary: revision.summary,
        applicability: revision.applicability,
        safety: revision.safety,
        checklist: revision.checklist.length ? revision.checklist : [''],
        body: revision.body,
        edit_summary: revision.edit_summary,
      })
      void queryClient.invalidateQueries({ queryKey: articleKeys.mine })
      void queryClient.invalidateQueries({ queryKey: articleKeys.overview })
      void queryClient.invalidateQueries({ queryKey: articleKeys.reviews })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteDraft(symptomId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: articleKeys.draft(symptomId) })
      void queryClient.invalidateQueries({ queryKey: articleKeys.mine })
      void queryClient.invalidateQueries({ queryKey: articleKeys.overview })
      onDeleted()
    },
  })
  const officialMutation = useMutation({
    mutationFn: async () => {
      const saved = await saveMutation.mutateAsync(normalizedDraft())
      return publishOfficialSeed(
        saved.id,
        draft.edit_summary.trim() || '发布首批官方种子内容',
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: articleKeys.published(symptomId),
      })
      void queryClient.invalidateQueries({
        queryKey: articleKeys.versions(symptomId),
      })
      void queryClient.invalidateQueries({ queryKey: articleKeys.mine })
      onPublished()
    },
  })

  useEffect(() => {
    if (initialized || draftQuery.isPending || draftFailed) return
    const source = draftQuery.data ?? publishedRevision
    setDraft({
      title: source?.title ?? symptomName,
      summary: source?.summary ?? symptomDescription,
      applicability: source?.applicability ?? '',
      safety: source?.safety ?? '',
      checklist: source?.checklist.length ? source.checklist : [''],
      body: source?.body ?? '',
      edit_summary: source?.edit_summary ?? '',
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

  function normalizedDraft() {
    return {
      ...draft,
      checklist: draft.checklist.map((item) => item.trim()).filter(Boolean),
    }
  }

  async function performAction(action: 'save' | 'submit' | 'official') {
    setLocalError('')
    setConfirmAction(null)
    if (action !== 'save' && !draft.edit_summary.trim()) {
      setLocalError('提交审核前请填写修改说明。')
      return
    }
    if (action === 'official') {
      if (
        !window.confirm(
          '确认以维护者身份发布为官方种子内容？此入口只用于首批文章，发布会立即生效并留下记录。',
        )
      ) {
        return
      }
      await officialMutation.mutateAsync()
      return
    }
    await saveMutation.mutateAsync(normalizedDraft())
    if (action === 'submit') await submitMutation.mutateAsync()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null
    const action = (submitter?.value ?? 'save') as
      | 'save'
      | 'submit'
      | 'official'
    if (action === 'save') {
      await performAction(action)
      return
    }
    if (!draft.edit_summary.trim()) {
      setLocalError('提交前请填写修改说明。')
      return
    }
    const missing = missingDraftSections(draft)
    if (missing.length) {
      setMissingSections(missing)
      setConfirmAction(action)
      return
    }
    await performAction(action)
  }

  function useTemplate() {
    const hasBody = Boolean(richTextPlainText(draft.body))
    if (
      hasBody &&
      !window.confirm('保留现有正文，并在末尾追加标准排障模板？')
    ) {
      return
    }
    updateField('body', insertTroubleshootingTemplate(draft.body))
  }

  function removeDraft() {
    if (!window.confirm('删除这份未提交草稿？此操作无法撤销。')) return
    deleteMutation.mutate()
  }

  function withdrawDraft() {
    if (!window.confirm('撤回这份待审核版本并继续编辑？')) return
    withdrawMutation.mutate()
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
        <div className={styles.pendingActions}>
          <p>撤回后，这份版本会恢复为草稿并保留全部内容。</p>
          <button
            type="button"
            disabled={withdrawMutation.isPending}
            onClick={withdrawDraft}
          >
            <RotateCcw aria-hidden="true" size={16} />
            {withdrawMutation.isPending ? '正在撤回…' : '撤回并继续编辑'}
          </button>
          {withdrawMutation.isError ? (
            <span className={styles.error} role="alert">
              {withdrawMutation.error instanceof ApiError
                ? withdrawMutation.error.message
                : '撤回失败，请重试'}
            </span>
          ) : null}
        </div>
      </section>
    )
  }

  const mutationError =
    saveMutation.error ??
    submitMutation.error ??
    officialMutation.error ??
    deleteMutation.error

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
        <div className={styles.sectionHeading}>
          <h2>排查正文</h2>
          <button type="button" onClick={useTemplate}>
            <FileStack aria-hidden="true" size={16} />
            使用排障模板
          </button>
        </div>
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
      {confirmAction ? (
        <aside className={styles.completeness} aria-live="polite">
          <div>
            <strong>这些内容还没有明确写出</strong>
            <span>{missingSections.join('、')}</span>
          </div>
          <p>
            这是写作提醒，不会限制特殊案例。你可以返回补充，或确认后继续。
          </p>
          <div>
            <button type="button" onClick={() => setConfirmAction(null)}>
              返回补充
            </button>
            <button
              className={styles.primary}
              type="button"
              disabled={saveMutation.isPending || officialMutation.isPending}
              onClick={() => void performAction(confirmAction)}
            >
              <Send aria-hidden="true" size={16} />
              仍然{confirmAction === 'official' ? '作为官方种子发布' : '提交审核'}
            </button>
          </div>
        </aside>
      ) : null}
      {saveMutation.isSuccess && !submitMutation.isPending ? (
        <p className={styles.success} role="status">
          草稿已保存
        </p>
      ) : null}

      <footer className={styles.actions}>
        {draftQuery.data &&
        draftQuery.data.status === 'draft' ? (
          <button
            className={styles.danger}
            type="button"
            disabled={deleteMutation.isPending}
            onClick={removeDraft}
          >
            <Trash2 aria-hidden="true" size={16} />
            删除草稿
          </button>
        ) : (
          <button type="button" onClick={onCancel}>
            取消
          </button>
        )}
        {currentUser.data?.role === 'admin' && !publishedRevision ? (
          <button
            type="submit"
            value="official"
            disabled={
              saveMutation.isPending ||
              submitMutation.isPending ||
              officialMutation.isPending
            }
          >
            发布官方种子
          </button>
        ) : null}
        <button type="submit" value="save" disabled={saveMutation.isPending}>
          保存
        </button>
        <button
          className={styles.primary}
          type="submit"
          value="submit"
          disabled={
            saveMutation.isPending ||
            submitMutation.isPending ||
            officialMutation.isPending
          }
        >
          提交审核
        </button>
      </footer>
    </form>
  )
}
