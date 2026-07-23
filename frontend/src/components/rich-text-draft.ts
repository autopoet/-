import { useEffect, useRef, useState } from 'react'

export type RichTextDraftSnapshot = {
  revision: number
  savedAt: string
  content: string
}

type StoredDrafts = {
  schemaVersion: 1
  snapshots: RichTextDraftSnapshot[]
}

function storageName(key: string) {
  return `diansai-rich-text:${key}`
}

function readDrafts(key?: string): RichTextDraftSnapshot[] {
  if (!key || typeof window === 'undefined') return []
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageName(key)) ?? '') as StoredDrafts
    if (stored.schemaVersion !== 1 || !Array.isArray(stored.snapshots)) return []
    return stored.snapshots.filter(
      (snapshot) =>
        typeof snapshot.revision === 'number' &&
        typeof snapshot.savedAt === 'string' &&
        typeof snapshot.content === 'string',
    )
  } catch {
    return []
  }
}

export function useVersionedRichTextDraft({
  storageKey,
  content,
  enabled = true,
  delay = 900,
  limit = 8,
}: {
  storageKey?: string
  content: string
  enabled?: boolean
  delay?: number
  limit?: number
}) {
  const [snapshots, setSnapshots] = useState<RichTextDraftSnapshot[]>(() =>
    readDrafts(storageKey),
  )
  const [status, setStatus] = useState<'idle' | 'pending' | 'saved' | 'error'>(
    'idle',
  )
  const activeKey = useRef(storageKey)

  useEffect(() => {
    if (activeKey.current === storageKey) return
    activeKey.current = storageKey
    setSnapshots(readDrafts(storageKey))
    setStatus('idle')
  }, [storageKey])

  useEffect(() => {
    if (!enabled || !storageKey || !content) return
    if (snapshots[0]?.content === content) return
    setStatus('pending')
    const timer = window.setTimeout(() => {
      try {
        const current = readDrafts(storageKey)
        if (current[0]?.content === content) {
          setSnapshots(current)
          setStatus('saved')
          return
        }
        const snapshot: RichTextDraftSnapshot = {
          revision: (current[0]?.revision ?? 0) + 1,
          savedAt: new Date().toISOString(),
          content,
        }
        const next = [snapshot, ...current].slice(0, Math.max(1, limit))
        const stored: StoredDrafts = { schemaVersion: 1, snapshots: next }
        window.localStorage.setItem(storageName(storageKey), JSON.stringify(stored))
        setSnapshots(next)
        setStatus('saved')
      } catch {
        setStatus('error')
      }
    }, delay)
    return () => window.clearTimeout(timer)
  }, [content, delay, enabled, limit, snapshots, storageKey])

  function clear() {
    if (storageKey && typeof window !== 'undefined') {
      window.localStorage.removeItem(storageName(storageKey))
    }
    setSnapshots([])
    setStatus('idle')
  }

  return { snapshots, latest: snapshots[0], status, clear }
}
