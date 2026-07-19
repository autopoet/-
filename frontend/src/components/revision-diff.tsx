import type { ArticleRevision } from '../api/articles'
import styles from './revision-diff.module.css'

type DiffKind = 'context' | 'addition' | 'deletion'

type DiffLine = {
  kind: DiffKind
  oldNumber?: number
  newNumber?: number
  text: string
}

function splitLines(value: string) {
  return value ? value.replace(/\r\n/g, '\n').split('\n') : []
}

function fallbackDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  return [
    ...oldLines.map((text, index) => ({
      kind: 'deletion' as const,
      oldNumber: index + 1,
      text,
    })),
    ...newLines.map((text, index) => ({
      kind: 'addition' as const,
      newNumber: index + 1,
      text,
    })),
  ]
}

function diffLines(oldValue: string, newValue: string): DiffLine[] {
  const oldLines = splitLines(oldValue)
  const newLines = splitLines(newValue)

  if (oldLines.length * newLines.length > 250_000) {
    return fallbackDiff(oldLines, newLines)
  }

  const table = Array.from(
    { length: oldLines.length + 1 },
    () => new Uint32Array(newLines.length + 1),
  )

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      table[oldIndex][newIndex] =
        oldLines[oldIndex] === newLines[newIndex]
          ? table[oldIndex + 1][newIndex + 1] + 1
          : Math.max(
              table[oldIndex + 1][newIndex],
              table[oldIndex][newIndex + 1],
            )
    }
  }

  const result: DiffLine[] = []
  let oldIndex = 0
  let newIndex = 0
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (
      oldIndex < oldLines.length &&
      newIndex < newLines.length &&
      oldLines[oldIndex] === newLines[newIndex]
    ) {
      result.push({
        kind: 'context',
        oldNumber: oldIndex + 1,
        newNumber: newIndex + 1,
        text: oldLines[oldIndex],
      })
      oldIndex += 1
      newIndex += 1
    } else if (
      newIndex < newLines.length &&
      (oldIndex === oldLines.length ||
        table[oldIndex][newIndex + 1] > table[oldIndex + 1][newIndex])
    ) {
      result.push({
        kind: 'addition',
        newNumber: newIndex + 1,
        text: newLines[newIndex],
      })
      newIndex += 1
    } else {
      result.push({
        kind: 'deletion',
        oldNumber: oldIndex + 1,
        text: oldLines[oldIndex],
      })
      oldIndex += 1
    }
  }
  return result
}

const fields = [
  ['标题', (revision: ArticleRevision) => revision.title],
  ['摘要', (revision: ArticleRevision) => revision.summary],
  ['适用范围', (revision: ArticleRevision) => revision.applicability],
  ['安全提示', (revision: ArticleRevision) => revision.safety],
  ['快速检查清单', (revision: ArticleRevision) => revision.checklist.join('\n')],
  ['正文', (revision: ArticleRevision) => revision.body],
] as const

export function RevisionDiff({
  baseRevision,
  revision,
}: {
  baseRevision: ArticleRevision | null
  revision: ArticleRevision
}) {
  const changedFields = fields
    .map(([label, read]) => ({
      label,
      lines: diffLines(baseRevision ? read(baseRevision) : '', read(revision)),
      changed: !baseRevision || read(baseRevision) !== read(revision),
    }))
    .filter((field) => field.changed)

  return (
    <section className={styles.diff} aria-label="版本差异">
      <header className={styles.header}>
        <div>
          <strong>
            {baseRevision ? `v${baseRevision.version_number}` : '空白文档'}
            {' → '}
            v{revision.version_number}
          </strong>
          <span>{changedFields.length} 个部分发生变化</span>
        </div>
        <p>{revision.edit_summary}</p>
      </header>

      {changedFields.map((field) => (
        <section key={field.label} className={styles.field}>
          <h3>{field.label}</h3>
          <div className={styles.lines} role="table" aria-label={`${field.label}差异`}>
            {field.lines.map((line, index) => (
              <div
                key={`${line.kind}-${line.oldNumber ?? 0}-${line.newNumber ?? 0}-${index}`}
                className={`${styles.line} ${styles[line.kind]}`}
                role="row"
              >
                <span className={styles.number} aria-label="旧版本行号">
                  {line.oldNumber ?? ''}
                </span>
                <span className={styles.number} aria-label="新版本行号">
                  {line.newNumber ?? ''}
                </span>
                <span className={styles.mark} aria-hidden="true">
                  {line.kind === 'addition'
                    ? '+'
                    : line.kind === 'deletion'
                      ? '−'
                      : ' '}
                </span>
                <code>{line.text || ' '}</code>
              </div>
            ))}
          </div>
        </section>
      ))}
    </section>
  )
}
