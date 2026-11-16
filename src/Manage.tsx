import { useEffect, useRef, useState } from 'react'
import bookmarklet from 'virtual:bookmarklet'
import bookmarkletSource from '../bookmarklet/export.js?url'
import { compare, countBookmarks, type State } from './cycle'
import { parseSnapshot, type Snapshot } from './snapshot'

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
        <h2>1. Export your bookmarks from X</h2>
        <ExportInstructions />
        <p className="note">
          The exporter runs inside your X tab. It reads your bookmarks through the internal API that x.com itself uses,
          with your current login. Your login details stay in that tab and go only to X. The file contains post IDs and
          nothing else. X doesn't document or endorse this API, so it can change, rate-limit, or stop working, and Resurface
          can't promise that using it carries no risk to your X account. A finished export holds the bookmarks X
          returned, which Resurface can't verify against your full history.
        </p>
      </section>

      <section>
        <h2>2. Import the file</h2>
        <Importer state={state} problem={problem} onImport={onImport} />
      </section>

      <footer className="page-footer">
        <a href="#settings">Storage, privacy, and settings</a>
      </footer>
    </main>
  )
}

const exportScript = decodeURIComponent(bookmarklet.slice('javascript:'.length))

function ExportInstructions() {
  const [method, setMethod] = useState<'bookmarklet' | 'console'>('bookmarklet')
  const [copyStatus, setCopyStatus] = useState('')
  const scriptField = useRef<HTMLTextAreaElement>(null)

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(exportScript)
      setCopyStatus('Script copied. Paste it into the Console on X.')
    } catch {
      setCopyStatus('Copy was blocked. Open View script, select the code, and copy it manually.')
    }
  }

  return (
    <>
      <fieldset className="export-method">
        <legend>Choose an export method</legend>
        <label>
          <input type="radio" name="export-method" checked={method === 'bookmarklet'} onChange={() => setMethod('bookmarklet')} />
          Bookmarks bar
        </label>
        <label>
          <input type="radio" name="export-method" checked={method === 'console'} onChange={() => setMethod('console')} />
          DevTools Console
        </label>
      </fieldset>
      <ol>
        <li>
          Open{' '}
          <a href="https://x.com/i/history" target="_blank" rel="noreferrer">x.com/i/history</a>{' '}
          while logged in. Choose Bookmarks, not Likes, and use the main list rather than a folder.
        </li>
        {method === 'bookmarklet' ? (
          <>
            <li>
              Drag <BookmarkletLink /> to your bookmarks bar. Show the bar with Ctrl+Shift+B, or ⌘+Shift+B on a Mac.
            </li>
            <li>Return to your X tab and click Export for Resurface in the bookmarks bar.</li>
          </>
        ) : (
          <>
            <li>
              <button type="button" onClick={copyScript}>Copy export script</button>
              {copyStatus && <p className="note" role="status">{copyStatus}</p>}
              <details className="script-preview">
                <summary>View script</summary>
                <textarea
                  ref={scriptField}
                  aria-label="Export script"
                  value={exportScript}
                  readOnly
                  spellCheck={false}
                  rows={8}
                />
                <button type="button" onClick={() => scriptField.current?.select()}>Select script</button>
              </details>
            </li>
            <li>
              In the X tab, open the Console with Ctrl+Shift+J, or ⌘+Option+J on a Mac. Paste the script and press Enter.
              The browser may block pasting as a security precaution. Review the source and follow its instructions
              only if you understand and trust the code. Never paste an unfamiliar script into a logged-in tab.
            </li>
          </>
        )}
        <li>Keep the X tab open while the exporter runs. It scrolls briefly, shows progress, and downloads your JSON file.</li>
      </ol>
      <p className="note">
        Both methods run the same code in your X tab.{' '}
        <a href={bookmarkletSource} target="_blank" rel="noreferrer">Read the exporter's source</a>.
      </p>
    </>
  )
}

function BookmarkletLink() {
  const link = useRef<HTMLAnchorElement>(null)
  useEffect(() => link.current?.setAttribute('href', bookmarklet), [])
  return (
    <a ref={link} className="bookmarklet" title="Drag me to your bookmarks bar" onClick={(event) => event.preventDefault()}>
      Export for Resurface
    </a>
  )
}

function Importer({ state, problem, onImport }: Pick<Props, 'state' | 'problem' | 'onImport'>) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function choose(file: File | undefined) {
    setSnapshot(null)
    setError(null)
    if (!file) return
    try {
      setSnapshot(parseSnapshot(await file.text()))
    } catch (failure) {
      setError((failure as Error).message)
    }
  }

  function cancel() {
    setSnapshot(null)
    if (input.current) input.current.value = ''
  }

  return (
    <div className="importer">
      <label className="file">
        Choose the exported .json file
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          disabled={!state}
          onChange={(event) => choose(event.target.files?.[0])}
        />
      </label>
      {!state && !problem && <p className="note">Opening browser storage…</p>}
      {error && (
        <p className="warning" role="alert">
          {error} Nothing was imported.
        </p>
      )}
      {state && snapshot && (
        <Preview
          key={snapshot.exportedAt}
          state={state}
          snapshot={snapshot}
          onApply={async () => (await onImport(snapshot)) && cancel()}
          onCancel={cancel}
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
          <input type="checkbox" checked={clear} onChange={(event) => setClear(event.target.checked)} /> This file has
          no bookmarks. Yes, empty my collection.
        </label>
      )}
      <label className="check">
        <input type="checkbox" checked={complete} onChange={(event) => setComplete(event.target.checked)} /> This file
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

