import { useState } from 'react'
import { countBookmarks, type State } from './cycle'

type Props = {
  state: State | null
  problem: string | null
  onReset: () => Promise<boolean>
}

export function Settings({ state, problem, onReset }: Props) {
  const count = state?.order.length ?? 0

  return (
    <main className="manage">
      <nav className="page-navigation" aria-label="Page">
        <a href="#">Back to Resurface</a>
      </nav>
      {problem && <p className="alert" role="alert">{problem}</p>}
      <header>
        <h1>Settings</h1>
        <p className="lead">Your collection stays in this browser.</p>
      </header>
      <section>
        <h2>Storage and privacy</h2>
        <ul>
          <li>Resurface has no server. Your collection is a list of post IDs and your place in the shuffle.</li>
          <li>
            It stays when you close the tab or browser. Clearing site data, private browsing, or the browser reclaiming
            space can remove it. Another browser profile or web address has separate storage. Resurface asks the browser
            to keep your data, but the browser decides.
          </li>
          <li>There is one collection per browser profile. Importing an export from another X account replaces it.</li>
          <li>Only one Resurface tab can be active at a time to prevent conflicting progress updates.</li>
          <li>
            Official X cards contact X when they load. Resurface asks X not to use the embeds for personalization,
            but that doesn't make you anonymous to X.
          </li>
          <li>
            Blockers such as Brave Shields can prevent cards from loading. Resurface doesn't change your blocker settings.
          </li>
          <li>Resurface has no analytics of its own and loads no external fonts.</li>
        </ul>
      </section>
      <section>
        <h2>Reset collection</h2>
        <p className="note">
          {count > 0 ? `${countBookmarks(count)} saved in this browser.` : 'No bookmarks are saved in this browser.'}{' '}
          Reset removes your collection and progress from Resurface, not from X. You can import your bookmarks again later.
        </p>
        <ResetCollection count={count} onReset={onReset} />
      </section>
    </main>
  )
}

function ResetCollection({ count, onReset }: { count: number; onReset: Props['onReset'] }) {
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  async function resetCollection() {
    setSaving(true)
    if (await onReset()) setConfirming(false)
    setSaving(false)
  }

  if (!confirming) {
    return (
      <button type="button" className="danger" disabled={count === 0} onClick={() => setConfirming(true)}>
        Reset collection…
      </button>
    )
  }

  return (
    <div className="warning destructive">
      <p>
        Delete {count === 1 ? 'the 1 bookmark' : `all ${countBookmarks(count)}`}, the shuffle order, your progress,
        and the import history from this browser?
      </p>
      <div className="actions">
        <button type="button" className="danger" disabled={saving} onClick={resetCollection}>
          {saving ? 'Deleting…' : 'Delete everything'}
        </button>
        <button type="button" disabled={saving} onClick={() => setConfirming(false)}>Cancel</button>
      </div>
    </div>
  )
}
