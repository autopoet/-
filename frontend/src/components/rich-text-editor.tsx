import { mergeAttributes, Node, type Editor } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { TableKit } from '@tiptap/extension-table'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Braces,
  Check,
  Code2,
  Columns3,
  Eye,
  History,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  PencilLine,
  Quote,
  Redo2,
  Rows3,
  Sigma,
  Table2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  type RichTextDraftSnapshot,
  useVersionedRichTextDraft,
} from './rich-text-draft'
import styles from './rich-text-editor.module.css'
import {
  normalizeRichTextValue,
  parseRichTextValue,
} from '../lib/rich-text-document'

export type RichTextEditorMode = 'edit' | 'preview'

export type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  placeholder?: string
  readOnly?: boolean
  mode?: RichTextEditorMode
  onModeChange?: (mode: RichTextEditorMode) => void
  autoSaveKey?: string
  autoSaveDelay?: number
  onUploadImage?: (file: File) => Promise<string>
  className?: string
}

const InlineFormula = Node.create({
  name: 'inlineFormula',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      formula: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-formula') ?? '',
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-inline-formula]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const formula = String(node.attrs.formula ?? '')
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-inline-formula': '',
        'data-formula': formula,
        'aria-label': `公式 ${formula}`,
        contenteditable: 'false',
        role: 'math',
      }),
      formula,
    ]
  },
})

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onPress,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onPress: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={active ? styles.activeTool : undefined}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  )
}

function safeUrl(value: string, kind: 'link' | 'image') {
  const input = value.trim()
  if (input.startsWith('/') && !input.startsWith('//')) return input
  try {
    const url = new URL(input.includes(':') ? input : `https://${input}`)
    const allowed =
      url.protocol === 'https:' ||
      url.protocol === 'http:' ||
      (kind === 'link' && url.protocol === 'mailto:')
    return allowed ? url.toString() : ''
  } catch {
    return ''
  }
}

function editorStatusText(
  status: 'idle' | 'pending' | 'saved' | 'error',
  latest?: RichTextDraftSnapshot,
) {
  if (status === 'pending') return '正在自动保存…'
  if (status === 'error') return '自动保存失败'
  if (latest) {
    return `已自动保存 ${new Date(latest.savedAt).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }
  return '本地自动保存已开启'
}

function RichTextToolbar({
  editor,
  openInsert,
}: {
  editor: Editor
  openInsert: (panel: 'link' | 'image' | 'formula') => void
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      paragraph: current.isActive('paragraph'),
      heading2: current.isActive('heading', { level: 2 }),
      heading3: current.isActive('heading', { level: 3 }),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      code: current.isActive('code'),
      bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'),
      blockquote: current.isActive('blockquote'),
      codeBlock: current.isActive('codeBlock'),
      link: current.isActive('link'),
      formula: current.isActive('inlineFormula'),
      table: current.isActive('table'),
      canUndo:
        current.isInitialized &&
        !current.isDestroyed &&
        current.can().chain().focus().undo().run(),
      canRedo:
        current.isInitialized &&
        !current.isDestroyed &&
        current.can().chain().focus().redo().run(),
    }),
  })

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="正文格式">
      <div className={styles.toolGroup} aria-label="段落样式">
        <ToolbarButton
          label="正文"
          active={state.paragraph}
          onPress={() => editor.chain().focus().setParagraph().run()}
        >
          <span className={styles.textTool}>正文</span>
        </ToolbarButton>
        <ToolbarButton
          label="二级标题"
          active={state.heading2}
          onPress={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <span className={styles.textTool}>H2</span>
        </ToolbarButton>
        <ToolbarButton
          label="三级标题"
          active={state.heading3}
          onPress={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <span className={styles.textTool}>H3</span>
        </ToolbarButton>
      </div>

      <div className={styles.toolGroup} aria-label="行内格式">
        <ToolbarButton
          label="粗体"
          active={state.bold}
          onPress={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold aria-hidden="true" size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="斜体"
          active={state.italic}
          onPress={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic aria-hidden="true" size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="行内代码"
          active={state.code}
          onPress={() => editor.chain().focus().toggleCode().run()}
        >
          <Code2 aria-hidden="true" size={17} />
        </ToolbarButton>
      </div>

      <div className={styles.toolGroup} aria-label="正文结构">
        <ToolbarButton
          label="无序列表"
          active={state.bulletList}
          onPress={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List aria-hidden="true" size={18} />
        </ToolbarButton>
        <ToolbarButton
          label="有序列表"
          active={state.orderedList}
          onPress={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered aria-hidden="true" size={18} />
        </ToolbarButton>
        <ToolbarButton
          label="引用"
          active={state.blockquote}
          onPress={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote aria-hidden="true" size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="代码块"
          active={state.codeBlock}
          onPress={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Braces aria-hidden="true" size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="分隔线"
          onPress={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus aria-hidden="true" size={18} />
        </ToolbarButton>
      </div>

      <div className={styles.toolGroup} aria-label="插入内容">
        <ToolbarButton label="链接" active={state.link} onPress={() => openInsert('link')}>
          <Link2 aria-hidden="true" size={17} />
        </ToolbarButton>
        {state.link ? (
          <ToolbarButton
            label="移除链接"
            onPress={() => editor.chain().focus().unsetLink().run()}
          >
            <X aria-hidden="true" size={17} />
          </ToolbarButton>
        ) : null}
        <ToolbarButton label="图片" onPress={() => openInsert('image')}>
          <ImagePlus aria-hidden="true" size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="行内公式"
          active={state.formula}
          onPress={() => openInsert('formula')}
        >
          <Sigma aria-hidden="true" size={18} />
        </ToolbarButton>
        <ToolbarButton
          label={state.table ? '光标位于表格中' : '插入 3 × 3 表格'}
          active={state.table}
          disabled={state.table}
          onPress={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <Table2 aria-hidden="true" size={17} />
        </ToolbarButton>
      </div>

      {state.table ? (
        <div className={styles.toolGroup} aria-label="表格编辑">
          <ToolbarButton
            label="增加一行"
            onPress={() => editor.chain().focus().addRowAfter().run()}
          >
            <Rows3 aria-hidden="true" size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="增加一列"
            onPress={() => editor.chain().focus().addColumnAfter().run()}
          >
            <Columns3 aria-hidden="true" size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="删除当前行"
            onPress={() => editor.chain().focus().deleteRow().run()}
          >
            <span className={styles.textTool}>− 行</span>
          </ToolbarButton>
          <ToolbarButton
            label="删除当前列"
            onPress={() => editor.chain().focus().deleteColumn().run()}
          >
            <span className={styles.textTool}>− 列</span>
          </ToolbarButton>
          <ToolbarButton
            label="删除表格"
            onPress={() => editor.chain().focus().deleteTable().run()}
          >
            <Trash2 aria-hidden="true" size={17} />
          </ToolbarButton>
        </div>
      ) : null}

      <div className={styles.toolGroup} aria-label="编辑历史">
        <ToolbarButton
          label="撤销"
          disabled={!state.canUndo}
          onPress={() => editor.chain().focus().undo().run()}
        >
          <Undo2 aria-hidden="true" size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="重做"
          disabled={!state.canRedo}
          onPress={() => editor.chain().focus().redo().run()}
        >
          <Redo2 aria-hidden="true" size={17} />
        </ToolbarButton>
      </div>
    </div>
  )
}

export function RichTextEditor({
  value,
  onChange,
  ariaLabel = '文档正文',
  placeholder = '从故障现象开始记录…',
  readOnly = false,
  mode,
  onModeChange,
  autoSaveKey,
  autoSaveDelay = 900,
  onUploadImage,
  className = '',
}: RichTextEditorProps) {
  const [internalMode, setInternalMode] = useState<RichTextEditorMode>(
    readOnly ? 'preview' : 'edit',
  )
  const [serializedValue, setSerializedValue] = useState(() =>
    normalizeRichTextValue(value),
  )
  const [insertPanel, setInsertPanel] = useState<'link' | 'image' | 'formula' | null>(
    null,
  )
  const [insertValue, setInsertValue] = useState('')
  const [imageAlt, setImageAlt] = useState('')
  const [insertError, setInsertError] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const onChangeRef = useRef(onChange)
  const editorValueRef = useRef(serializedValue)
  const insertInputRef = useRef<HTMLInputElement>(null)
  const resolvedMode = readOnly ? 'preview' : (mode ?? internalMode)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      TableKit.configure({
        table: { resizable: false, renderWrapper: true },
      }),
      Image.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder }),
      InlineFormula,
    ],
    content: parseRichTextValue(value),
    editable: resolvedMode === 'edit',
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
        class: styles.proseMirror,
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: current }) => {
      const next = JSON.stringify(current.getJSON())
      editorValueRef.current = next
      setSerializedValue(next)
      onChangeRef.current(next)
    },
  })

  const drafts = useVersionedRichTextDraft({
    storageKey: autoSaveKey,
    content: serializedValue,
    enabled: Boolean(autoSaveKey) && !readOnly,
    delay: autoSaveDelay,
  })

  useEffect(() => {
    if (!editor) return
    const next = normalizeRichTextValue(value)
    if (next === editorValueRef.current) return
    editorValueRef.current = next
    setSerializedValue(next)
    editor.commands.setContent(parseRichTextValue(next), { emitUpdate: false })
  }, [editor, value])

  useEffect(() => {
    editor?.setEditable(resolvedMode === 'edit')
    if (resolvedMode === 'preview') setInsertPanel(null)
  }, [editor, resolvedMode])

  useEffect(() => {
    if (insertPanel) insertInputRef.current?.focus()
  }, [insertPanel])

  function changeMode(next: RichTextEditorMode) {
    if (readOnly && next === 'edit') return
    if (mode === undefined) setInternalMode(next)
    onModeChange?.(next)
  }

  function openInsert(panel: 'link' | 'image' | 'formula') {
    setInsertPanel(panel)
    setInsertError('')
    setImageAlt('')
    setInsertValue(
      panel === 'link' && editor?.isActive('link')
        ? String(editor.getAttributes('link').href ?? '')
        : panel === 'formula' && editor?.isActive('inlineFormula')
          ? String(editor.getAttributes('inlineFormula').formula ?? '')
          : '',
    )
  }

  function closeInsert() {
    setInsertPanel(null)
    setInsertError('')
    setInsertValue('')
    setImageAlt('')
    editor?.commands.focus()
  }

  async function uploadSelectedImage(file?: File) {
    if (!file || !onUploadImage) return
    if (file.size > 10 * 1024 * 1024) {
      setInsertError('图片不能超过 10 MB。')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setInsertError('只支持 JPG、PNG 和 WebP 图片。')
      return
    }
    setUploadingImage(true)
    setInsertError('')
    try {
      const url = await onUploadImage(file)
      setInsertValue(url)
      if (!imageAlt) setImageAlt(file.name.replace(/\.[^.]+$/, ''))
    } catch (error) {
      setInsertError(error instanceof Error ? error.message : '图片上传失败。')
    } finally {
      setUploadingImage(false)
    }
  }

  function applyInsert() {
    if (!editor || !insertPanel) return
    if (insertPanel === 'formula') {
      const formula = insertValue.trim()
      if (!formula) {
        setInsertError('请输入公式文本。')
        return
      }
      if (editor.isActive('inlineFormula')) {
        editor.chain().focus().updateAttributes('inlineFormula', { formula }).run()
      } else {
        editor
          .chain()
          .focus()
          .insertContent({ type: 'inlineFormula', attrs: { formula } })
          .run()
      }
      closeInsert()
      return
    }

    const url = safeUrl(insertValue, insertPanel)
    if (!url) {
      setInsertError(
        insertPanel === 'image'
          ? '请输入 http 或 https 图片地址。'
          : '请输入站内路径、http、https 或邮箱链接。',
      )
      return
    }
    if (insertPanel === 'image') {
      editor.chain().focus().setImage({ src: url, alt: imageAlt.trim() }).run()
    } else if (editor.state.selection.empty) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: url,
          marks: [{ type: 'link', attrs: { href: url } }],
        })
        .run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
    closeInsert()
  }

  function handleInsertKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') closeInsert()
    if (event.key === 'Enter') {
      event.preventDefault()
      applyInsert()
    }
  }

  function restoreSnapshot(snapshot: RichTextDraftSnapshot) {
    if (!editor) return
    editor.commands.setContent(parseRichTextValue(snapshot.content), {
      emitUpdate: true,
    })
    setHistoryOpen(false)
    changeMode('edit')
  }

  if (!editor) return null

  return (
    <section
      className={`${styles.editor} ${className}`.trim()}
      data-mode={resolvedMode}
    >
      {!readOnly ? (
        <header className={styles.modeRail}>
          <div className={styles.modeSwitch} role="group" aria-label="编辑器模式">
            <button
              type="button"
              aria-pressed={resolvedMode === 'edit'}
              onClick={() => changeMode('edit')}
            >
              <PencilLine aria-hidden="true" size={16} />
              编辑
            </button>
            <button
              type="button"
              aria-pressed={resolvedMode === 'preview'}
              onClick={() => changeMode('preview')}
            >
              <Eye aria-hidden="true" size={16} />
              预览
            </button>
          </div>

          {autoSaveKey ? (
            <div className={styles.saveState} data-state={drafts.status}>
              {drafts.status === 'saved' ? <Check aria-hidden="true" size={15} /> : null}
              <span>{editorStatusText(drafts.status, drafts.latest)}</span>
              {drafts.snapshots.length ? (
                <button
                  type="button"
                  aria-expanded={historyOpen}
                  onClick={() => setHistoryOpen((current) => !current)}
                >
                  <History aria-hidden="true" size={15} />
                  本地版本
                </button>
              ) : null}
            </div>
          ) : null}
        </header>
      ) : null}

      {historyOpen ? (
        <aside className={styles.historyPanel} aria-label="本地自动保存版本">
          <ol>
            {drafts.snapshots.map((snapshot) => (
              <li key={snapshot.revision}>
                <span>v{snapshot.revision}</span>
                <time dateTime={snapshot.savedAt}>
                  {new Date(snapshot.savedAt).toLocaleString('zh-CN')}
                </time>
                <button type="button" onClick={() => restoreSnapshot(snapshot)}>
                  恢复
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className={styles.clearHistory} onClick={drafts.clear}>
            <Trash2 aria-hidden="true" size={15} />
            清除本地版本
          </button>
        </aside>
      ) : null}

      {resolvedMode === 'edit' ? (
        <RichTextToolbar editor={editor} openInsert={openInsert} />
      ) : null}

      {resolvedMode === 'edit' && insertPanel ? (
        <div className={styles.insertRail} role="group" aria-label="插入内容">
          <strong>
            {insertPanel === 'link'
              ? '链接'
              : insertPanel === 'image'
                ? '图片'
                : '公式'}
          </strong>
          {insertPanel === 'image' && onUploadImage ? (
            <input
              className={styles.fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="上传图片"
              disabled={uploadingImage}
              onChange={(event) =>
                void uploadSelectedImage(event.target.files?.[0])
              }
            />
          ) : null}
          <input
            ref={insertInputRef}
            type="text"
            inputMode={insertPanel === 'formula' ? 'text' : 'url'}
            aria-label={insertPanel === 'formula' ? '公式文本' : '地址'}
            placeholder={
              insertPanel === 'formula'
                ? '例如 Vout = Vin × R2 / (R1 + R2)'
                : insertPanel === 'image'
                  ? '上传后自动填写，或粘贴图片地址'
                  : 'https://…'
            }
            value={insertValue}
            onChange={(event) => setInsertValue(event.target.value)}
            onKeyDown={handleInsertKeyDown}
          />
          {insertPanel === 'image' ? (
            <input
              type="text"
              aria-label="图片说明"
              placeholder="图片说明（建议填写）"
              value={imageAlt}
              onChange={(event) => setImageAlt(event.target.value)}
              onKeyDown={handleInsertKeyDown}
            />
          ) : null}
          <button
            type="button"
            className={styles.confirmInsert}
            disabled={uploadingImage}
            onClick={applyInsert}
          >
            {uploadingImage ? '上传中…' : '插入'}
          </button>
          <button type="button" aria-label="取消插入" onClick={closeInsert}>
            <X aria-hidden="true" size={17} />
          </button>
          {insertError ? (
            <span className={styles.insertError} role="alert">
              {insertError}
            </span>
          ) : null}
        </div>
      ) : null}

      <EditorContent className={styles.content} editor={editor} />
    </section>
  )
}
