import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { countBookmarks, next, previous, shuffleAgain, type State } from './cycle'
import { Post } from './Post'

type Props = {
  state: State
  problem: string | null
  onChange: (from: State, change: (state: State) => State) => Promise<boolean>
  onManage: () => void
}

const KEYS: Record<string, 1 | -1> = { ArrowRight: 1, j: 1, ArrowLeft: -1, k: -1 }

export default function Reader({ state, problem, onChange, onManage }: Props) {
  const { order, viewed, position } = state
  const reel = useRef<HTMLDivElement>(null)

  const align = useCallback(() => {
    const panel = reel.current?.querySelector(`[data-index="${position}"]`)
    const box = panel?.getBoundingClientRect()
    if (box && (box.top > innerHeight / 2 || box.bottom <= innerHeight / 2)) panel!.scrollIntoView({ block: 'start' })
  }, [position])

  useLayoutEffect(() => align(), [align, order])

  const go = useCallback(
    async (change: (state: State) => State) => {
      if (!(await onChange(state, change))) align()
    },
    [state, onChange, align],
  )

  useEffect(() => {
    const onScrollEnd = () => {
      if (document.hidden) return
      const middle = innerHeight / 2
      const panels = reel.current?.querySelectorAll<HTMLElement>('[data-index]') ?? []
      const target = [...panels].find((panel) => {
        const box = panel.getBoundingClientRect()
        return box.top <= middle && box.bottom > middle
      })
      const index = Number(target?.dataset.index)
      if (target && index !== position) go(index > position ? next : previous)
    }
    const onVisibility = () => !document.hidden && align()
    document.addEventListener('scrollend', onScrollEnd)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('resize', align)
    return () => {
      document.removeEventListener('scrollend', onScrollEnd)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', align)
    }
  }, [position, go, align])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const step = KEYS[event.key]
      if (!step || event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return
      event.preventDefault()
      go(step > 0 ? next : previous)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go])

  const indices = [position - 1, position, position + 1].filter((index) => index >= 0 && index <= order.length)

  return (
    <main className="reader">
      <h1 className="visually-hidden">Resurface</h1>
      <div className="reel" ref={reel}>
        {indices.map((index) => (
          <section key={order[index] ?? 'end'} className="panel" data-index={index}>
            {index === order.length ? (
              <div className="completion">
                <h2>Cycle complete</h2>
                <p>
                  You've passed {order.length === 1 ? 'the only bookmark' : `all ${countBookmarks(order.length)}`} in
                  this shuffle.
                </p>
                <button type="button" className="primary" onClick={() => go(shuffleAgain)}>
                  Shuffle again
                </button>
              </div>
            ) : index < position ? (
              <p className="note">Previous bookmark</p>
            ) : (
              <Post id={order[index]} onNext={index === position ? () => go(next) : undefined} />
            )}
          </section>
        ))}
      </div>
      <nav className="controls" aria-label="Reader">
        {problem && (
          <p className="alert" role="alert">
            {problem}
          </p>
        )}
        <p role="status" aria-label={`${viewed} of ${countBookmarks(order.length)} viewed`}>
          {viewed} of {order.length}
        </p>
        <progress value={viewed} max={order.length} aria-hidden="true" />
        <div className="step">
          <button type="button" onClick={() => go(previous)} disabled={position === 0}>
            Previous
          </button>
          <button type="button" className="primary" onClick={() => go(next)} disabled={position === order.length}>
            Next
          </button>
        </div>
        <button type="button" onClick={onManage}>
          Import bookmarks
        </button>
        <p className="note">
          Scroll, or press <kbd>←</kbd> <kbd>→</kbd> or <kbd>K</kbd> <kbd>J</kbd> while the post isn't focused.
        </p>
      </nav>
    </main>
  )
}
