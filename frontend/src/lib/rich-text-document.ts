export type RichTextDocumentNode = {
  type?: string
  attrs?: Record<string, unknown>
  content?: RichTextDocumentNode[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  text?: string
}

export const EMPTY_RICH_TEXT_VALUE = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph' }],
})

function textContent(lines: string[]): RichTextDocumentNode[] {
  return lines.flatMap((line, index) => [
    ...(index ? [{ type: 'hardBreak' }] : []),
    ...(line ? [{ type: 'text', text: line }] : []),
  ])
}

function paragraph(lines: string[]): RichTextDocumentNode {
  const content = textContent(lines)
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

function listItem(text: string): RichTextDocumentNode {
  return { type: 'listItem', content: [paragraph([text])] }
}

export function markdownToRichTextDocument(value: string): RichTextDocumentNode {
  const blocks: RichTextDocumentNode[] = []
  const paragraphLines: string[] = []
  const lines = value.replace(/\r\n/g, '\n').split('\n')

  function flushParagraph() {
    if (!paragraphLines.length) return
    blocks.push(paragraph([...paragraphLines]))
    paragraphLines.length = 0
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      continue
    }

    const fence = trimmed.match(/^```(?:\S+)?\s*$/)
    if (fence) {
      flushParagraph()
      const code: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        code.push(lines[index])
        index += 1
      }
      blocks.push({
        type: 'codeBlock',
        content: code.length ? [{ type: 'text', text: code.join('\n') }] : undefined,
      })
      continue
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      blocks.push({
        type: 'heading',
        attrs: { level: heading[1].length <= 2 ? 2 : 3 },
        content: [{ type: 'text', text: heading[2].trim() }],
      })
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph()
      blocks.push({ type: 'horizontalRule' })
      continue
    }

    const bullet = trimmed.match(/^[-*+]\s+(.+)$/)
    if (bullet) {
      flushParagraph()
      const items = [listItem(bullet[1])]
      while (index + 1 < lines.length) {
        const next = lines[index + 1].trim().match(/^[-*+]\s+(.+)$/)
        if (!next) break
        items.push(listItem(next[1]))
        index += 1
      }
      blocks.push({ type: 'bulletList', content: items })
      continue
    }

    const ordered = trimmed.match(/^(\d+)[.)]\s+(.+)$/)
    if (ordered) {
      flushParagraph()
      const items = [listItem(ordered[2])]
      const start = Number(ordered[1])
      while (index + 1 < lines.length) {
        const next = lines[index + 1].trim().match(/^\d+[.)]\s+(.+)$/)
        if (!next) break
        items.push(listItem(next[1]))
        index += 1
      }
      blocks.push({
        type: 'orderedList',
        attrs: start === 1 ? undefined : { start },
        content: items,
      })
      continue
    }

    const quote = trimmed.match(/^>\s?(.*)$/)
    if (quote) {
      flushParagraph()
      const quoteLines = [quote[1]]
      while (index + 1 < lines.length) {
        const next = lines[index + 1].trim().match(/^>\s?(.*)$/)
        if (!next) break
        quoteLines.push(next[1])
        index += 1
      }
      blocks.push({ type: 'blockquote', content: [paragraph(quoteLines)] })
      continue
    }

    paragraphLines.push(trimmed)
  }

  flushParagraph()
  return {
    type: 'doc',
    content: blocks.length ? blocks : [{ type: 'paragraph' }],
  }
}

export function parseRichTextValue(value: string): RichTextDocumentNode {
  if (!value.trim()) {
    return JSON.parse(EMPTY_RICH_TEXT_VALUE) as RichTextDocumentNode
  }
  try {
    const parsed = JSON.parse(value) as RichTextDocumentNode
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') return parsed
  } catch {
    // Existing revisions are Markdown; convert them below.
  }
  return markdownToRichTextDocument(value)
}

export function normalizeRichTextValue(value: string) {
  return JSON.stringify(parseRichTextValue(value))
}
