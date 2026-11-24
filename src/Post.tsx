import { useEffect, useRef, useState } from 'react'

type Twttr = {
  ready(callback: (twttr: Twttr) => void): void
  widgets: {
    createTweet(id: string, target: HTMLElement, options: Record<string, unknown>): Promise<HTMLElement | undefined>
  }
}

declare global {
  interface Window {
    twttr?: Pick<Twttr, 'ready'> & { _e?: unknown[] }
  }
}

const OPTIONS = { theme: 'dark', dnt: true, conversation: 'none', align: 'center' }
const TIMEOUT = 15_000

let widgets: Promise<Twttr> | undefined

function loadWidgets(): Promise<Twttr> {
  widgets ??= new Promise<Twttr>((resolve, reject) => {
    const queue: Array<(twttr: Twttr) => void> = []
    window.twttr = { _e: queue, ready: (callback) => queue.push(callback) }
    window.twttr.ready(resolve)
    const script = document.createElement('script')
    script.src = 'https://platform.x.com/widgets.js'
    script.async = true
    script.onerror = () => {
      script.remove()
      widgets = undefined
      reject(new Error('widgets.js did not load'))
    }
    document.head.append(script)
  })
  return widgets
}

export function Post({ id, onNext, onLater }: { id: string; onNext?: () => void; onLater?: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const target = host.current!.appendChild(document.createElement('div'))
    let live = true
    loadWidgets()
      .then((twttr) => twttr.widgets.createTweet(id, target, OPTIONS))
      .then(
        (element) => live && setStatus(element ? 'ready' : 'failed'),
        () => live && setStatus('failed'),
      )
    const timer = setTimeout(() => live && setStatus((now) => (now === 'loading' ? 'failed' : now)), TIMEOUT)
    return () => {
      live = false
      clearTimeout(timer)
      target.remove()
    }
  }, [id, attempt])

  return (
    <div className="post">
      <div ref={host} />
      {status === 'loading' && <p className="note loading">Loading the post from X…</p>}
      {status === 'failed' && (
        <div className="failure">
          <p>
            <strong>This post didn't load.</strong> It may be deleted, protected, or restricted, or a network problem or a
            blocker such as Brave Shields may have stopped X's embed. It stays in your collection.
          </p>
          <div className="actions">
            <button
              type="button"
              onClick={() => {
                setStatus('loading')
                setAttempt((count) => count + 1)
              }}
            >
              Retry
            </button>
            {onLater && (
              <button type="button" onClick={onLater}>
                Later
              </button>
            )}
            {onNext && (
              <button type="button" onClick={onNext}>
                Next
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
