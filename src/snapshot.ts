export const SNAPSHOT_KIND = 'resurface-bookmark-snapshot'
export const SNAPSHOT_VERSION = 1

export type Snapshot = { exportedAt: string; ids: string[]; duplicates: number }

type Unchecked = { kind?: unknown; version?: unknown; status?: unknown; exportedAt?: unknown; count?: unknown; bookmarks?: unknown }

export function parseSnapshot(text: string): Snapshot {
  let data: Unchecked | null
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (data?.kind !== SNAPSHOT_KIND) throw new Error('This file is not a Resurface bookmark export.')
  if (data.version !== SNAPSHOT_VERSION) {
    throw new Error(`This export uses format version ${String(data.version)}, which this version of Resurface can't read.`)
  }
  if (data.status !== 'complete') throw new Error("This export isn't marked complete. Run the exporter again.")
  const { exportedAt } = data
  if (typeof exportedAt !== 'string' || Number.isNaN(Date.parse(exportedAt)) || new Date(exportedAt).toISOString() !== exportedAt) {
    throw new Error("This export doesn't have a valid export time.")
  }
  if (!Array.isArray(data.bookmarks) || data.count !== data.bookmarks.length) {
    throw new Error("This export's bookmark count doesn't match its contents.")
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
