export type State = { order: string[]; viewed: number; position: number; exportedAt: string | null }

export const EMPTY: State = { order: [], viewed: 0, position: 0, exportedAt: null }

export function next(state: State): State {
  if (state.position >= state.order.length) return state
  return { ...state, position: state.position + 1, viewed: Math.max(state.viewed, state.position + 1) }
}

export function previous(state: State): State {
  return state.position > 0 ? { ...state, position: state.position - 1 } : state
}

export const canLater = ({ order, viewed, position }: State) => position === viewed && position < order.length - 1

export function later(state: State): State {
  if (!canLater(state)) return state
  const { order, position } = state
  const rest = order.filter((_, index) => index !== position)
  return { ...state, order: [...rest.slice(0, position + 1), ...insertRandomly(rest.slice(position + 1), [order[position]])] }
}

export function shuffleAgain(state: State): State {
  return { ...state, order: insertRandomly([], state.order), viewed: 0, position: 0 }
}

export function samePlace(a: State, b: State) {
  return (
    a.position === b.position &&
    a.viewed === b.viewed &&
    a.order.length === b.order.length &&
    a.order.every((id, index) => id === b.order[index])
  )
}

export const countBookmarks = (count: number) => `${count} ${count === 1 ? 'bookmark' : 'bookmarks'}`

export function compare(state: State, ids: string[]) {
  const incoming = new Set(ids)
  const known = new Set(state.order)
  return {
    added: ids.filter((id) => !known.has(id)).length,
    removed: state.order.filter((id) => !incoming.has(id)).length,
  }
}

export function reconcile(state: State, ids: string[], exportedAt: string): State {
  const incoming = new Set(ids)
  const known = new Set(state.order)
  const current = state.order[state.position]
  const currentKept = current !== undefined && incoming.has(current)

  const passed = state.order.slice(0, state.viewed).filter((id) => incoming.has(id))
  const upcoming = state.order.slice(state.viewed).filter((id) => incoming.has(id))
  const pinned = currentKept && state.position === state.viewed ? upcoming.splice(0, 1) : []
  const order = [...passed, ...pinned, ...insertRandomly(upcoming, ids.filter((id) => !known.has(id)))]

  return { order, viewed: passed.length, position: currentKept ? order.indexOf(current) : passed.length, exportedAt }
}

function insertRandomly(list: string[], ids: string[]): string[] {
  const result = [...list]
  for (const id of ids) result.splice(Math.floor(Math.random() * (result.length + 1)), 0, id)
  return result
}
