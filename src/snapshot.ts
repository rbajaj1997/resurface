export const SNAPSHOT_KIND = 'resurface-bookmark-snapshot'
export const SNAPSHOT_VERSION = 1
export const HANDOFF_HELLO = 'resurface-hello'
export const HANDOFF_READY = 'resurface-ready'
export const X_ORIGIN = 'https://x.com'

export type Snapshot = { exportedAt: string; ids: string[]; duplicates: number }

type Unchecked = { kind?: unknown; version?: unknown; status?: unknown; exportedAt?: unknown; count?: unknown; bookmarks?: unknown }

export function parseSnapshot(received: unknown): Snapshot {
  const data = received as Unchecked | null
  if (data?.kind !== SNAPSHOT_KIND) throw new Error('This is not a Resurface bookmark import.')
  if (data.version !== SNAPSHOT_VERSION) {
    throw new Error(`This import uses format version ${String(data.version)}, which this version of Resurface can't read. Drag the latest Send to Resurface to your bookmarks bar.`)
  }
  if (data.status !== 'complete') throw new Error("This import isn't marked complete. Run Send to Resurface again.")
  const { exportedAt } = data
  if (typeof exportedAt !== 'string' || Number.isNaN(Date.parse(exportedAt)) || new Date(exportedAt).toISOString() !== exportedAt) {
    throw new Error("This import doesn't have a valid export time.")
  }
  if (!Array.isArray(data.bookmarks) || data.count !== data.bookmarks.length) {
    throw new Error("This import's bookmark count doesn't match its contents.")
  }
  const ids: string[] = data.bookmarks.map((bookmark: { id?: unknown } | null, index: number) => {
    if (typeof bookmark?.id !== 'string' || !/^\d+$/.test(bookmark.id)) {
      throw new Error(`Bookmark ${index + 1} doesn't have a valid post ID.`)
    }
    return bookmark.id
  })
  const unique = [...new Set(ids)]
  return { exportedAt, ids: unique, duplicates: ids.length - unique.length }
}
