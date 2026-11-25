(() => {
  const RUNNING = Symbol.for('resurface.export')
  if (window[RUNNING]) return alert('Send to Resurface is already running in this tab.')
  if (location.origin !== 'https://x.com' || !/^\/i\/history\/?$/.test(location.pathname)) {
    return alert('Send to Resurface: in Resurface, click Open X bookmarks, then click Send to Resurface in the X tab that opens.')
  }
  window[RUNNING] = true

  const BOOKMARKS_PATH = /\/graphql\/[^/]+\/Bookmarks$/
  const CAPTURE_TIMEOUT = 20000
  const PAGE_DELAY = 500
  const TERMINAL_DIRECTIONS = ['Bottom', 'TopAndBottom']
  const MAX_EMPTY_PAGES = 10
  const HANDOFF_TIMEOUT = 2000

  const controller = new AbortController()
  const { signal } = controller
  const nativeFetch = window.fetch
  const xhr = XMLHttpRequest.prototype
  const native = { open: xhr.open, setRequestHeader: xhr.setRequestHeader, send: xhr.send }
  let pendingXhr = new WeakMap()

  let capturing = false
  let request = null
  let cursor = null
  const cursors = new Set()
  const ids = []
  const seen = new Set()

  const panel = document.createElement('div')
  panel.setAttribute('role', 'status')
  Object.assign(panel.style, {
    position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483647', width: '340px',
    padding: '16px', borderRadius: '12px', border: '1px solid #2f3336', background: '#16181c',
    color: '#e7e9ea', font: '14px/1.45 system-ui, sans-serif', boxShadow: '0 8px 24px rgba(0,0,0,.5)',
  })
  const heading = document.createElement('strong')
  heading.textContent = 'Send to Resurface'
  const message = document.createElement('p')
  message.style.margin = '8px 0 12px'
  const actions = document.createElement('div')
  Object.assign(actions.style, { display: 'flex', gap: '8px', alignItems: 'center' })
  panel.append(heading, message, actions)
  document.body.append(panel)

  function show(text, buttons = [['Cancel', closeExporter]]) {
    message.textContent = text
    actions.replaceChildren(...buttons.map(([label, onClick]) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = label
      button.onclick = onClick
      Object.assign(button.style, {
        font: 'inherit', color: '#e7e9ea', background: '#2f3336', border: '0', borderRadius: '999px',
        padding: '6px 14px', cursor: 'pointer',
      })
      return button
    }))
  }

  const countBookmarks = (count) => `${count} ${count === 1 ? 'bookmark' : 'bookmarks'}`

  function sleep(ms) {
    return new Promise((resolve, reject) => {
      const onAbort = () => { clearTimeout(timer); reject(signal.reason) }
      const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, ms)
      signal.addEventListener('abort', onAbort, { once: true })
    })
  }

  function isBookmarksRequest(url) {
    try { return BOOKMARKS_PATH.test(new URL(url, location.href).pathname) } catch { return false }
  }

  function capture(method, url, headers) {
    if (request) return
    let variables
    const href = new URL(url, location.href).href
    try { variables = JSON.parse(new URL(href).searchParams.get('variables')) } catch { variables = null }
    if (String(method).toUpperCase() !== 'GET' || typeof variables !== 'object' || variables === null) {
      throw new Error("X's bookmark request has a format Resurface doesn't support.")
    }
    request = { url: href, headers }
  }

  let captureError = null
  const record = (fn) => { try { fn() } catch (error) { captureError = error } }

  const hookedFetch = function (input, init) {
    record(() => {
      const isRequest = input instanceof Request
      const url = isRequest ? input.url : String(input)
      if (!capturing || !isBookmarksRequest(url)) return
      capture(
        init?.method ?? (isRequest ? input.method : 'GET'),
        url,
        new Headers(init?.headers ?? (isRequest ? input.headers : undefined)),
      )
    })
    return nativeFetch.apply(this, arguments)
  }
  const hookedOpen = function (method, url) {
    record(() => { if (capturing && isBookmarksRequest(String(url))) pendingXhr.set(this, { method, url: String(url), headers: new Headers() }) })
    return native.open.apply(this, arguments)
  }
  const hookedSetRequestHeader = function (name, value) {
    record(() => pendingXhr.get(this)?.headers.append(name, value))
    return native.setRequestHeader.apply(this, arguments)
  }
  const hookedSend = function () {
    const pending = pendingXhr.get(this)
    if (pending) {
      pendingXhr.delete(this)
      if (capturing) record(() => capture(pending.method, pending.url, pending.headers))
    }
    return native.send.apply(this, arguments)
  }

  function installRequestHooks() {
    capturing = true
    window.fetch = hookedFetch
    xhr.open = hookedOpen
    xhr.setRequestHeader = hookedSetRequestHeader
    xhr.send = hookedSend
  }

  function restoreRequestHooks() {
    capturing = false
    pendingXhr = new WeakMap()
    if (window.fetch === hookedFetch) window.fetch = nativeFetch
    if (xhr.open === hookedOpen) xhr.open = native.open
    if (xhr.setRequestHeader === hookedSetRequestHeader) xhr.setRequestHeader = native.setRequestHeader
    if (xhr.send === hookedSend) xhr.send = native.send
  }

  async function captureRequest() {
    show("Looking for X's bookmark request. The page scrolls by itself for a moment.")
    const startY = scrollY
    captureError = null
    installRequestHooks()
    try {
      for (let waited = 0; !request; waited += 500) {
        if (captureError) throw captureError
        if (waited >= CAPTURE_TIMEOUT) {
          throw new Error("Couldn't find X's bookmark request. Make sure the Bookmarks tab is open, not Likes. Then reload this page, wait for your bookmarks to appear, and click Send to Resurface again before scrolling.")
        }
        if (waited % 1000 === 0) scrollTo(0, document.documentElement.scrollHeight)
        await sleep(500)
      }
    } finally {
      restoreRequestHooks()
      scrollTo(0, startY)
    }
  }

  async function fetchPage() {
    const url = new URL(request.url)
    const variables = JSON.parse(url.searchParams.get('variables'))
    if (cursor) variables.cursor = cursor
    else delete variables.cursor
    url.searchParams.set('variables', JSON.stringify(variables))

    const response = await nativeFetch.call(window, url, { headers: request.headers, credentials: 'include', signal })
    if (response.status === 429) {
      const reset = Number(response.headers.get('x-rate-limit-reset'))
      throw new Error(reset
        ? `X's rate limit was reached. Retry after ${new Date(reset * 1000).toLocaleTimeString()}.`
        : "X's rate limit was reached. Wait a few minutes, then retry.")
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(`X refused the request (HTTP ${response.status}). Check that you are logged in, then retry.`)
    }
    if (!response.ok) throw new Error(`X answered with HTTP ${response.status}.`)
    try { return await response.json() } catch { throw new Error("X's response wasn't valid JSON.") }
  }

  function readPage(body) {
    if (Array.isArray(body?.errors) && body.errors.length) {
      throw new Error(`X reported an error: ${String(body.errors[0]?.message ?? 'unknown error')}`)
    }
    const timeline = Object.values(body?.data ?? {}).find((value) => Array.isArray(value?.timeline?.instructions))?.timeline
    if (!timeline) throw new Error("X's response didn't contain a bookmark timeline.")

    const page = { ids: [], cursor: null, done: false }
    const readEntry = (entry) => {
      const entryId = String(entry?.entryId)
      const content = entry?.content
      if (content?.cursorType) {
        if (content.cursorType === 'Bottom') page.cursor = content.value
        return
      }
      if (entryId.startsWith('promoted-')) return
      const match = /^tweet-(\d+)$/.exec(entryId)
      if (!match) throw new Error(`X's response had an unrecognized entry (${entryId}).`)
      const result = content?.itemContent?.tweet_results?.result
      const restId = result?.rest_id ?? result?.tweet?.rest_id
      if (restId != null && restId !== match[1]) throw new Error(`Entry ${entryId} points at a different post.`)
      page.ids.push(match[1])
    }

    for (const instruction of timeline.instructions) {
      const type = instruction?.type
      if (type === 'TimelineAddEntries' && Array.isArray(instruction.entries)) instruction.entries.forEach(readEntry)
      else if (type === 'TimelineReplaceEntry') readEntry(instruction.entry)
      else if (type === 'TimelineTerminateTimeline') page.done ||= TERMINAL_DIRECTIONS.includes(instruction.direction)
      else if (type !== 'TimelineClearCache') throw new Error(`X's response had an unrecognized instruction (${String(type)}).`)
    }
    page.done ||= page.ids.length === 0 && page.cursor === null
    if (!page.done && typeof page.cursor !== 'string') throw new Error("X's response didn't have a usable cursor for the next page.")
    return page
  }

  async function exportBookmarks() {
    let emptyPages = 0
    try {
      if (!(await connectToResurface())) {
        throw new Error('Resurface didn\'t answer. In Resurface, click Open X bookmarks, then use the X tab it opens.')
      }
      if (!request) await captureRequest()
      for (;;) {
        show(`Reading bookmarks. ${countBookmarks(ids.length)} so far. Keep this tab open.`)
        const page = readPage(await fetchPage())
        const before = ids.length
        for (const id of page.ids) {
          if (!seen.has(id)) { seen.add(id); ids.push(id) }
        }
        if (page.done) break
        if (page.ids.length > 0) {
          emptyPages = 0
          if (ids.length === before) throw new Error('X sent a page with only bookmarks already exported, so the export stopped instead of looping.')
        } else {
          if (page.cursor === cursor) break
          if (++emptyPages >= MAX_EMPTY_PAGES) {
            throw new Error(`X sent ${MAX_EMPTY_PAGES} pages in a row with no bookmarks that still point to more pages, so Resurface can't tell whether your bookmarks have ended. Retry follows them further.`)
          }
        }
        if (cursors.has(page.cursor)) throw new Error('X sent a page cursor that was already used, so the export cannot finish safely.')
        cursors.add(page.cursor)
        cursor = page.cursor
        await sleep(PAGE_DELAY)
      }
      request = null
      sendToResurface()
    } catch (error) {
      request = null
      if (signal.aborted) return
      show(`Stopped. ${error?.message ?? String(error)} Nothing was sent.`, [['Retry', exportBookmarks], ['Cancel', closeExporter]])
    }
  }

  function connectToResurface() {
    const resurface = window.opener
    if (!resurface) return Promise.resolve(false)
    show('Connecting to Resurface…')
    return new Promise((resolve) => {
      const finish = (connected) => {
        clearTimeout(timer)
        removeEventListener('message', onMessage)
        signal.removeEventListener('abort', onTimeout)
        resolve(connected)
      }
      const onMessage = (event) => {
        if (event.source === resurface && event.origin === RESURFACE_ORIGIN && event.data?.kind === HANDOFF_READY) finish(true)
      }
      const onTimeout = () => finish(false)
      const timer = setTimeout(onTimeout, HANDOFF_TIMEOUT)
      addEventListener('message', onMessage)
      signal.addEventListener('abort', onTimeout, { once: true })
      resurface.postMessage({ kind: HANDOFF_HELLO }, RESURFACE_ORIGIN)
    })
  }

  function sendToResurface() {
    if (!window.opener) throw new Error('The Resurface tab was closed. Open X bookmarks from Resurface again.')
    window.opener.postMessage({
      kind: SNAPSHOT_KIND,
      version: SNAPSHOT_VERSION,
      exportedAt: new Date().toISOString(),
      status: 'complete',
      count: ids.length,
      bookmarks: ids.map((id) => ({ id })),
    }, RESURFACE_ORIGIN)
    show(`Sent ${countBookmarks(ids.length)} to Resurface. Close this tab and review them there.`, [['Close tab', () => { closeExporter(); window.close() }]])
    window.close()
  }

  function closeExporter() {
    controller.abort()
    restoreRequestHooks()
    request = null
    panel.remove()
    delete window[RUNNING]
  }

  exportBookmarks()
})()
