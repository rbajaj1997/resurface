import { lazy, Suspense, useEffect, useState } from 'react'
import type { State } from './cycle'
import { importSnapshot, loadState, moveState, resetState } from './db'
import { Manage } from './Manage'
import { Settings } from './Settings'
import type { Snapshot } from './snapshot'
import './style.css'

const Reader = lazy(() => import('./Reader'))

export function App() {
  const [state, setState] = useState<State | null>(null)
  const [reading, setReading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [elsewhere, setElsewhere] = useState(false)
  const [claims, setClaims] = useState(0)

  useEffect(() => {
    let active = true
    let release = () => {}
    const onPageChange = () => {
      setSettingsOpen(location.hash === '#settings')
      setReading(false)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onPageChange)
    navigator.locks
      .request('resurface', { steal: true }, async () => {
        setElsewhere(false)
        try {
          const loaded = await loadState()
          if (active) {
            setState(loaded)
            setSettingsOpen(location.hash === '#settings')
            setReading(loaded.order.length > 0)
          }
        } catch {
          if (active) setProblem("Resurface couldn't open browser storage, so it can't load or save a collection. Private windows and some privacy settings block it.")
        }
        return new Promise<void>((resolve) => (release = resolve))
      })
      .catch(() => active && setElsewhere(true))
    return () => {
      active = false
      window.removeEventListener('hashchange', onPageChange)
      release()
    }
  }, [claims])

  async function commit(write: Promise<State>, failure: string) {
    try {
      const saved = await write
      setState(saved)
      setProblem(null)
      return saved
    } catch {
      setProblem(failure)
      return null
    }
  }

  async function onImport(snapshot: Snapshot) {
    const saved = await commit(importSnapshot(snapshot.ids, snapshot.exportedAt), "The import couldn't be saved. Your collection is unchanged.")
    if (saved) setReading(saved.order.length > 0)
    return saved !== null
  }

  async function onReset() {
    const saved = await commit(resetState(), "The reset couldn't be saved. Your collection is unchanged.")
    if (saved) setReading(false)
    return saved !== null
  }

  async function onChange(from: State, change: (state: State) => State) {
    const saved = await commit(moveState(from, change), "Resurface couldn't save that move, so it kept you on the last saved card.")
    return saved !== null
  }

  if (elsewhere) {
    return (
      <main className="manage">
        <h1>Resurface is open in another tab</h1>
        <p>Only one tab can be active, so two tabs can't overwrite each other's progress.</p>
        <button type="button" className="primary" onClick={() => setClaims((count) => count + 1)}>
          Use Resurface here
        </button>
      </main>
    )
  }

  if (settingsOpen) return <Settings state={state} problem={problem} onReset={onReset} />

  return state && reading && state.order.length > 0 ? (
    <Suspense fallback={<p className="note centered">Loading the reader…</p>}>
      <Reader state={state} problem={problem} onChange={onChange} onManage={() => setReading(false)} />
    </Suspense>
  ) : (
    <Manage state={state} problem={problem} onImport={onImport} onRead={() => setReading(true)} />
  )
}
