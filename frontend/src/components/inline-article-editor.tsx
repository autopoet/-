import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import {
  type ArticleDraft,
  type ArticleRevision,
  articleKeys,
  getDraft,
  saveDraft,
  submitDraft,
} from '../api/articles'
import { ApiError } from '../api/client'
import { demoArticles } from '../content/demo-articles'
import styles from './inline-article-editor.module.css'

type EditableSection = {
  id: string
  title: string
  content: string
}

const emptyDraft: ArticleDraft = {
  title: '',
  summary: '',
  applicability: '',
  safety: '',
  checklist: [''],
  body: '',
  edit_summary: '',
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function parseSections(body: string): EditableSection[] {
  const sections: EditableSection[] = []
  let title = '正文'
  let lines: string[] = []

  function finish() {
    if (lines.some((line) => line.trim())) {
      sections.push({ id: createId(), title, content: lines.join('\n').trim() })
    }
  }

  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('## ')) {
      finish()
      title = line.slice(3).trim() || '未命名章节'
      lines = []
    } else {
      lines.push(line)
    }
  }
  finish()
  return sections.length
    ? sections
    : [{ id: createId(), title: '正文', content: '' }]
}

function serializeSections(sections: EditableSection[]) {
  return sections
    .map(({ title, content }) => `## ${title.trim()}\n\n${content.trim()}`)
    .join('\n\n')
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
  const [draft, setDraft] = useState<ArticleDraft>(emptyDraft)
  const [sections, setSections] = useState<EditableSection[]>([])
  const [initialized, setInitialized] = useState(false)
  const [localError, setLocalError] = useState('')
  const draftQuery = useQuery({
    queryKey: articleKeys.draft(symptomId),
    queryFn: ({ signal }) => getDraft(symptomId, signal),
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
      void queryClient.invalidateQueries({ queryKey: articleKeys.reviews })
      onSubmitted()
    },
  })

  useEffect(() => {
    if (initialized || draftQuery.isPending) return
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
    setSections(parseSections(source.body))
    setInitialized(true)
  }, [
    draftQuery.data,
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

  function updateSection(
    id: string,
    field: 'title' | 'content',
    value: string,
  ) {
    setSections((current) =>
      current.map((section) =>
        section.id === id ? { ...section, [field]: value } : section,
      ),
    )
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
      body: serializeSections(sections),
    }
    await saveMutation.mutateAsync(payload)
    if (isSubmitting) await submitMutation.mutateAsync()
  }

  if (!initialized) {
    return <p className={styles.loading}>正在准备当前文档的编辑内容…</p>
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

      {sections.map((section, index) => (
        <section key={section.id} className={styles.bodySection}>
          <div>
            <span>章节 {index + 1}</span>
            <button
              type="button"
              aria-label={`删除章节 ${section.title}`}
              disabled={sections.length === 1}
              onClick={() =>
                setSections((current) =>
                  current.filter((item) => item.id !== section.id),
                )
              }
            >
              <Trash2 aria-hidden="true" size={16} />
            </button>
          </div>
          <input
            aria-label={`章节 ${index + 1} 标题`}
            required
            value={section.title}
            onChange={(event) =>
              updateSection(section.id, 'title', event.target.value)
            }
          />
          <textarea
            aria-label={`${section.title}正文`}
            required
            rows={8}
            value={section.content}
            onChange={(event) =>
              updateSection(section.id, 'content', event.target.value)
            }
          />
        </section>
      ))}

      <button
        className={styles.addSectionButton}
        type="button"
        onClick={() =>
          setSections((current) => [
            ...current,
            { id: createId(), title: '', content: '' },
          ])
        }
      >
        <Plus aria-hidden="true" size={17} />
        添加章节
      </button>

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
