import {
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  useMemo,
} from 'react'
import {
  parseRichTextValue,
  type RichTextDocumentNode,
} from '../lib/rich-text-document'
import styles from './rich-text-content.module.css'

export type RichTextHighlight = {
  id: number
  quote: string
  blockId: string | null
  startOffset?: number | null
  endOffset?: number | null
  detached?: boolean
}

type HighlightRange = RichTextHighlight & {
  start: number
  end: number
}

type ResolvedHighlight = RichTextHighlight & {
  localStart: number | null
  localEnd: number | null
}

type TextBlock = {
  text: string
  start: number
  end: number
}

const PLAIN_TEXT_BLOCKS = new Set([
  'blockquote',
  'bulletList',
  'codeBlock',
  'heading',
  'listItem',
  'orderedList',
  'paragraph',
])

function safeHref(value: unknown) {
  if (typeof value !== 'string') return ''
  const href = value.trim()
  if (href.startsWith('/') && !href.startsWith('//')) return href
  try {
    const url = new URL(href)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

function safeImageSource(value: unknown) {
  if (typeof value !== 'string') return ''
  const source = value.trim()
  if (source.startsWith('/') && !source.startsWith('//')) return source
  try {
    const url = new URL(source)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

function applyMarks(node: RichTextDocumentNode, content: ReactNode) {
  return (node.marks ?? []).reduce<ReactNode>((current, mark, index) => {
    if (mark.type === 'bold') return <strong key={`bold-${index}`}>{current}</strong>
    if (mark.type === 'italic') return <em key={`italic-${index}`}>{current}</em>
    if (mark.type === 'code') return <code key={`code-${index}`}>{current}</code>
    if (mark.type === 'strike') return <s key={`strike-${index}`}>{current}</s>
    if (mark.type === 'link') {
      const href = safeHref(mark.attrs?.href)
      return href ? (
        <a key={`link-${index}`} href={href} rel="noreferrer">
          {current}
        </a>
      ) : (
        current
      )
    }
    return current
  }, content)
}

function highlightText({
  node,
  ranges,
  cursor,
  onHighlightClick,
}: {
  node: RichTextDocumentNode
  ranges: HighlightRange[]
  cursor: { value: number }
  onHighlightClick?: (threadId: number) => void
}) {
  const text = node.text ?? ''
  const start = cursor.value
  const end = start + text.length
  cursor.value = end
  const boundaries = new Set([0, text.length])

  for (const range of ranges) {
    const overlapStart = Math.max(start, range.start)
    const overlapEnd = Math.min(end, range.end)
    if (overlapStart < overlapEnd) {
      boundaries.add(overlapStart - start)
      boundaries.add(overlapEnd - start)
    }
  }

  const points = [...boundaries].sort((a, b) => a - b)
  const pieces = points.slice(0, -1).map((from, index) => {
    const to = points[index + 1]
    const value = text.slice(from, to)
    const absolute = start + from
    const highlight = ranges.find(
      (range) => absolute >= range.start && absolute < range.end,
    )
    const marked = applyMarks(node, value)
    if (!highlight) return <Fragment key={`${start}-${from}`}>{marked}</Fragment>

    function activate(event: KeyboardEvent<HTMLElement>) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onHighlightClick?.(highlight!.id)
      }
    }

    return (
      <mark
        key={`${start}-${from}`}
        className={styles.highlight}
        data-thread-id={highlight.id}
        role="button"
        tabIndex={0}
        onClick={() => onHighlightClick?.(highlight.id)}
        onKeyDown={activate}
      >
        {marked}
      </mark>
    )
  })

  return pieces
}

function rangesForBlock(
  blockId: string,
  highlights: ResolvedHighlight[],
) {
  return highlights.flatMap<HighlightRange>((highlight) => {
    if (highlight.detached) return []
    if (
      highlight.blockId !== blockId ||
      highlight.localStart === null ||
      highlight.localEnd === null
    ) {
      return []
    }
    return [
      {
        ...highlight,
        start: highlight.localStart,
        end: highlight.localEnd,
      },
    ]
  })
}

function collectTextBlocks(
  node: RichTextDocumentNode,
  path: string,
  result: { text: string; blocks: Map<string, TextBlock> },
) {
  if (node.type === 'text') {
    result.text += node.text ?? ''
    return
  }
  if (node.type === 'hardBreak') {
    result.text += '\n'
    return
  }
  if (node.type === 'inlineFormula') {
    result.text += String(node.attrs?.formula ?? '')
    return
  }

  const start = result.text.length
  const children = node.content ?? []
  if (node.type === 'doc') {
    children.forEach((child, index) =>
      collectTextBlocks(child, `${index}`, result),
    )
    return
  }
  children.forEach((child, index) =>
    collectTextBlocks(child, `${path}-${index}`, result),
  )

  const end = result.text.length
  if (['paragraph', 'heading', 'codeBlock'].includes(node.type ?? '')) {
    result.blocks.set(`block-${path}`, {
      text: result.text.slice(start, end),
      start,
      end,
    })
  }
  if (
    node.type &&
    PLAIN_TEXT_BLOCKS.has(node.type) &&
    result.text &&
    !result.text.endsWith('\n')
  ) {
    result.text += '\n'
  }
}

function quotePositions(text: string, quote: string) {
  const positions: number[] = []
  let cursor = 0
  while (cursor <= text.length - quote.length) {
    const position = text.indexOf(quote, cursor)
    if (position < 0) break
    positions.push(position)
    cursor = position + 1
  }
  return positions
}

function resolveHighlightBlocks(
  document: RichTextDocumentNode,
  highlights: RichTextHighlight[],
) {
  const result = { text: '', blocks: new Map<string, TextBlock>() }
  collectTextBlocks(document, 'root', result)

  return highlights.map<ResolvedHighlight>((highlight) => {
    if (highlight.detached) {
      return { ...highlight, localStart: null, localEnd: null }
    }

    const hintStart = highlight.startOffset
    const hintEnd = highlight.endOffset
    if (
      hintStart !== null &&
      hintStart !== undefined &&
      hintEnd !== null &&
      hintEnd !== undefined &&
      result.text.slice(hintStart, hintEnd) === highlight.quote
    ) {
      const exactBlock = [...result.blocks].find(
        ([, block]) => hintStart >= block.start && hintEnd <= block.end,
      )
      if (exactBlock) {
        return {
          ...highlight,
          blockId: exactBlock[0],
          localStart: hintStart - exactBlock[1].start,
          localEnd: hintEnd - exactBlock[1].start,
        }
      }
    }

    const candidates = [...result.blocks].flatMap(([blockId, block]) => {
      if (highlight.blockId && highlight.blockId !== blockId) return []
      return quotePositions(block.text, highlight.quote).map((localStart) => ({
        blockId,
        block,
        localStart,
        globalStart: block.start + localStart,
      }))
    })
    const fallbackCandidates = candidates.length
      ? candidates
      : [...result.blocks].flatMap(([blockId, block]) =>
          quotePositions(block.text, highlight.quote).map((localStart) => ({
            blockId,
            block,
            localStart,
            globalStart: block.start + localStart,
          })),
        )
    const match =
      fallbackCandidates.length === 1
        ? fallbackCandidates[0]
        : hintStart === null || hintStart === undefined
          ? null
          : [...fallbackCandidates].sort(
              (left, right) =>
                Math.abs(left.globalStart - hintStart) -
                Math.abs(right.globalStart - hintStart),
            )[0]

    return match
      ? {
          ...highlight,
          blockId: match.blockId,
          localStart: match.localStart,
          localEnd: match.localStart + highlight.quote.length,
        }
      : { ...highlight, localStart: null, localEnd: null }
  })
}

function RichNode({
  node,
  path,
  highlights,
  onHighlightClick,
}: {
  node: RichTextDocumentNode
  path: string
  highlights: ResolvedHighlight[]
  onHighlightClick?: (threadId: number) => void
}): ReactNode {
  const children = node.content ?? []
  const blockId = `block-${path}`
  const ranges = rangesForBlock(blockId, highlights)
  const cursor = { value: 0 }
  const inline = () =>
    children.map((child, index) => {
      if (child.type === 'text') {
        return (
          <Fragment key={`${path}-text-${index}`}>
            {highlightText({ node: child, ranges, cursor, onHighlightClick })}
          </Fragment>
        )
      }
      if (child.type === 'hardBreak') {
        cursor.value += 1
        return <br key={`${path}-break-${index}`} />
      }
      if (child.type === 'inlineFormula') {
        const formula = String(child.attrs?.formula ?? '')
        cursor.value += formula.length
        return (
          <span
            key={`${path}-formula-${index}`}
            className={styles.formula}
            role="math"
            aria-label={`公式 ${formula}`}
          >
            {formula}
          </span>
        )
      }
      return (
        <RichNode
          key={`${path}-${index}`}
          node={child}
          path={`${path}-${index}`}
          highlights={highlights}
          onHighlightClick={onHighlightClick}
        />
      )
    })

  switch (node.type) {
    case 'doc':
      return children.map((child, index) => (
        <RichNode
          key={`root-${index}`}
          node={child}
          path={`${index}`}
          highlights={highlights}
          onHighlightClick={onHighlightClick}
        />
      ))
    case 'paragraph':
      return (
        <p data-comment-block-id={blockId}>
          {inline()}
        </p>
      )
    case 'heading': {
      const level = Number(node.attrs?.level) === 3 ? 3 : 2
      return level === 3 ? (
        <h3 id={blockId} data-comment-block-id={blockId}>
          {inline()}
        </h3>
      ) : (
        <h2 id={blockId} data-comment-block-id={blockId}>
          {inline()}
        </h2>
      )
    }
    case 'bulletList':
      return <ul>{children.map((child, index) => <RichNode key={index} node={child} path={`${path}-${index}`} highlights={highlights} onHighlightClick={onHighlightClick} />)}</ul>
    case 'orderedList':
      return <ol start={Number(node.attrs?.start) || 1}>{children.map((child, index) => <RichNode key={index} node={child} path={`${path}-${index}`} highlights={highlights} onHighlightClick={onHighlightClick} />)}</ol>
    case 'listItem':
      return <li>{children.map((child, index) => <RichNode key={index} node={child} path={`${path}-${index}`} highlights={highlights} onHighlightClick={onHighlightClick} />)}</li>
    case 'blockquote':
      return <blockquote>{children.map((child, index) => <RichNode key={index} node={child} path={`${path}-${index}`} highlights={highlights} onHighlightClick={onHighlightClick} />)}</blockquote>
    case 'horizontalRule':
      return <hr />
    case 'codeBlock':
      return (
        <pre data-comment-block-id={blockId} tabIndex={0}>
          <code>{inline()}</code>
        </pre>
      )
    case 'image': {
      const src = safeImageSource(node.attrs?.src)
      const alt = String(node.attrs?.alt ?? '')
      return src ? (
        <figure data-comment-block-id={blockId}>
          <img src={src} alt={alt} loading="lazy" />
          {alt ? <figcaption>{alt}</figcaption> : null}
        </figure>
      ) : null
    }
    case 'table':
      return (
        <div className={styles.tableScroller} role="region" tabIndex={0}>
          <table>
            <tbody>{children.map((child, index) => <RichNode key={index} node={child} path={`${path}-${index}`} highlights={highlights} onHighlightClick={onHighlightClick} />)}</tbody>
          </table>
        </div>
      )
    case 'tableRow':
      return <tr>{children.map((child, index) => <RichNode key={index} node={child} path={`${path}-${index}`} highlights={highlights} onHighlightClick={onHighlightClick} />)}</tr>
    case 'tableHeader':
      return <th>{children.map((child, index) => <RichNode key={index} node={child} path={`${path}-${index}`} highlights={highlights} onHighlightClick={onHighlightClick} />)}</th>
    case 'tableCell':
      return <td>{children.map((child, index) => <RichNode key={index} node={child} path={`${path}-${index}`} highlights={highlights} onHighlightClick={onHighlightClick} />)}</td>
    case 'text':
      return applyMarks(node, node.text ?? '')
    default:
      return children.map((child, index) => (
        <RichNode
          key={index}
          node={child}
          path={`${path}-${index}`}
          highlights={highlights}
          onHighlightClick={onHighlightClick}
        />
      ))
  }
}

export function RichTextContent({
  value,
  highlights = [],
  onHighlightClick,
}: {
  value: string
  highlights?: RichTextHighlight[]
  onHighlightClick?: (threadId: number) => void
}) {
  const document = useMemo(() => parseRichTextValue(value), [value])
  const resolvedHighlights = useMemo(
    () => resolveHighlightBlocks(document, highlights),
    [document, highlights],
  )
  return (
    <div className={styles.content}>
      <RichNode
        node={document}
        path="root"
        highlights={resolvedHighlights}
        onHighlightClick={onHighlightClick}
      />
    </div>
  )
}
