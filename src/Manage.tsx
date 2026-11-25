import { useEffect, useRef, useState } from 'react'
import bookmarklet from 'virtual:bookmarklet'
import bookmarkletSource from '../bookmarklet/export.js?url'
import { compare, countBookmarks, type State } from './cycle'
import { HANDOFF_HELLO, HANDOFF_READY, parseSnapshot, SNAPSHOT_KIND, X_ORIGIN, type Snapshot } from './snapshot'

type Props = {
  state: State | null
  problem: string | null
  onImport: (snapshot: Snapshot) => Promise<boolean>
  onRead: () => void
}

export function Manage({ state, problem, onImport, onRead }: Props) {
  const count = state?.order.length ?? 0
  return (
    <main className="manage">
      {problem && (
        <p className="alert" role="alert">
          {problem}
        </p>
      )}
      <header>
        <h1>Resurface</h1>
        <p className="lead">
          Revisit your X bookmarks one at a time, in a shuffled order that remembers where you stopped.
        </p>
        {count > 0 && (
          <p className="actions summary">
            <span>{countBookmarks(count)} saved in this browser.</span>
            <button type="button" className="primary" onClick={onRead}>
              Back to reader
            </button>
          </p>
        )}
      </header>

      <section>
        <h2>Import your bookmarks</h2>
        <ol>
          <li>
            Drag <BookmarkletLink /> to your bookmarks bar. You only do this once. Show the bar with ⌘+Shift+B on a Mac,
            or Ctrl+Shift+B.
          </li>
          <li>
            <a className="button primary" href="https://x.com/i/history" target="resurface-x" referrerPolicy="no-referrer">
              Open X bookmarks
            </a>
          </li>
          <li>On X, click Send to Resurface in your bookmarks bar. When it's done, close the tab and come back here.</li>
        </ol>
        <Importer state={state} problem={problem} onImport={onImport} />
        <p className="note">
          Send to Resurface reads your bookmarks with your X login, through X's internal API. X can change or block that
          API at any time. Only post IDs come back to Resurface.{' '}
          <a href={bookmarkletSource} target="_blank" rel="noreferrer">Read the source</a>.
        </p>
      </section>

      <footer className="page-footer">
        <a href="#settings">Storage, privacy, and settings</a>
      </footer>
    </main>
  )
}

function BookmarkletLink() {
  const link = useRef<HTMLAnchorElement>(null)
  useEffect(() => link.current?.setAttribute('href', bookmarklet), [])
  return (
    <a ref={link} className="bookmarklet" title="Drag me to your bookmarks bar" onClick={(event) => event.preventDefault()}>
      Send to Resurface
    </a>
  )
}

type Loaded = { snapshot: Snapshot } | { error: string } | null

function load(data: unknown): Loaded {
  try {
    return { snapshot: parseSnapshot(data) }
  } catch (failure) {
    return { error: (failure as Error).message }
  }
}

function Importer({ state, problem, onImport }: Pick<Props, 'state' | 'problem' | 'onImport'>) {
  const [loaded, setLoaded] = useState<Loaded>(null)
  const box = useRef<HTMLDivElement>(null)
  const snapshot = loaded && 'snapshot' in loaded ? loaded.snapshot : null

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== X_ORIGIN || !event.source) return
      if (event.data?.kind === HANDOFF_HELLO) {
        ;(event.source as Window).postMessage({ kind: HANDOFF_READY }, X_ORIGIN)
      } else if (event.data?.kind === SNAPSHOT_KIND) {
        setLoaded(load(event.data))
        box.current?.scrollIntoView({ block: 'start' })
        window.focus()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <div className="importer" ref={box}>
      {!state && !problem && <p className="note">Opening browser storage…</p>}
      {loaded && 'error' in loaded && (
        <p className="warning" role="alert">
          {loaded.error} Nothing was imported.
        </p>
      )}
      {state && snapshot && (
        <Preview
          key={snapshot.exportedAt}
          state={state}
          snapshot={snapshot}
          onApply={async () => (await onImport(snapshot)) && setLoaded(null)}
          onCancel={() => setLoaded(null)}
        />
      )}
    </div>
  )
}

type PreviewProps = { state: State; snapshot: Snapshot; onApply: () => Promise<unknown>; onCancel: () => void }

function Preview({ state, snapshot, onApply, onCancel }: PreviewProps) {
  const [complete, setComplete] = useState(false)
  const [clear, setClear] = useState(false)
  const [busy, setBusy] = useState(false)
  const { added, removed } = compare(state, snapshot.ids)
  const clears = snapshot.ids.length === 0 && state.order.length > 0
  const older = state.exportedAt !== null && Date.parse(snapshot.exportedAt) < Date.parse(state.exportedAt)

  async function apply() {
    setBusy(true)
    await onApply()
    setBusy(false)
  }

  return (
    <div className="preview">
      <dl>
        <dt>Exported</dt>
        <dd>{new Date(snapshot.exportedAt).toLocaleString()}</dd>
        <dt>New</dt>
        <dd>{added}</dd>
        <dt>Kept</dt>
        <dd>{snapshot.ids.length - added}</dd>
        <dt>Removed</dt>
        <dd>{removed}</dd>
        <dt>Duplicates ignored</dt>
        <dd>{snapshot.duplicates}</dd>
      </dl>
      {older && (
        <p className="warning">
          This export is older than the last one you imported ({new Date(state.exportedAt!).toLocaleString()}). Applying
          it can bring back bookmarks you have since removed on X.
        </p>
      )}
      {removed > 0 && (
        <p className="warning destructive">
          {countBookmarks(removed)} will leave Resurface, along with {removed === 1 ? 'its' : 'their'} progress in this
          shuffle.
        </p>
      )}
      {clears && (
        <label className="check warning destructive">
          <input type="checkbox" checked={clear} onChange={(event) => setClear(event.target.checked)} /> This export has
          no bookmarks. Yes, empty my collection.
        </label>
      )}
      <label className="check">
        <input type="checkbox" checked={complete} onChange={(event) => setComplete(event.target.checked)} /> This export
        is my complete, current bookmark collection. Bookmarks missing from it should be removed.
      </label>
      <p className="actions">
        <button type="button" className="primary" onClick={apply} disabled={!complete || (clears && !clear) || busy}>
          {busy ? 'Applying…' : 'Apply import'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </p>
    </div>
  )
}

