# Resurface v1 implementation plan

## Purpose and handoff status

This document records the product and implementation decisions agreed with Rohit. Another agent should be able to implement v1 from this document without repeating the product interview.

The repository was inspected before planning and was empty. No application scaffolding, dependencies, or existing conventions were present. This document is the only project file created during planning.

Stack revision: v1 was first built on Vike. Rohit later approved removing Vike. The app now uses plain Vite, React, and TypeScript with a small build-time renderer, and keeps build-time pre-rendered HTML with React hydration. The sections below describe the revised architecture.

Later revisions agreed with Rohit, reflected below:

- The exporter runs only on `https://x.com/i/history` with the Bookmarks tab selected. `/i/bookmarks` and `twitter.com` are no longer accepted.
- Besides the bookmarklet, the user can paste the same compiled exporter script into the DevTools Console.
- Storage/privacy information and Reset collection moved from the home page to a separate Settings view at `#settings`.
- The reader has no Open on X control, shows compact `N of M` progress, and labels its import action Import bookmarks.
- First-party source and config files carry no comments. Explanations live in README.md and this document.
- The reader has a Later action, also on the `L` key, that moves the current unviewed card to a random later spot in the cycle without marking it viewed. See [LATER.md](LATER.md).

Resurface helps a user revisit forgotten X bookmarks through a shuffled, reel-style reader. It is a static, local-first application with no application backend.

## Working constraints

- Follow the coding-principles skill. Prefer a small number of clear modules, pure data transformations, and one source of truth for each decision.
- Read the find-docs skill and consult current documentation before implementing library-specific APIs or configuration.
- Never commit or push without asking Rohit.
- Never run builds, linting, tests, application scripts, or browser automation without asking Rohit. Assume a development server is running rather than starting one without permission.
- This handoff is an implementation plan, not permission to execute commands covered by those restrictions.
- Do not introduce a runtime server, API proxy, authentication service, paid X API integration, extension, or cloud database.

## Agreed scope

### Included

- Desktop Chrome, Edge, and Brave.
- A self-contained exporter that runs in the user's logged-in X tab, started from a bookmarklet or pasted into the DevTools Console.
- A minimal, versioned Resurface JSON snapshot format.
- Local JSON import, preview, confirmation, and complete snapshot reconciliation.
- IndexedDB persistence of bookmarks, shuffle order, viewed state, and current position.
- A dark, reel-style reader using official X embedded posts.
- Native images and video as supported by X's widget.
- Previous/Next/Later controls, keyboard navigation outside embeds, and scrolling.
- A completion screen with an explicit Shuffle again action.
- Export instructions and import controls on the home page; storage/privacy information and a confirmed Reset collection action in a separate Settings view.
- Build-time pre-rendered HTML with React hydration.
- GitHub Pages deployment through GitHub Actions on pushes to main.

### Excluded

- X OAuth, automatic synchronization, or modifying bookmarks on X.
- Search, tags, folders, local favorites, snoozing beyond the current cycle's Later action, or local hiding.
- Multiple collections or an account selector.
- Backup/restore of Resurface state. Re-importing after storage loss is acceptable, even though progress is lost.
- Custom tweet cards, downloaded media archives, offline X cards, or guaranteed video autoplay.
- Mobile support, Safari, and Firefox as v1 commitments.
- Analytics, external fonts, large UI kits, global state frameworks, or a separate client-side routing library.
- Import compatibility with twitter-web-exporter or twitter-bookmark-search JSON. The latter is a flow reference only.

800 bookmarks is the expected collection size, not a hard limit. Never truncate a snapshot or stop exporting at 800. Larger collections may receive a notice that they are outside the intended v1 size, but do not require a separate implementation path.

## Primary user flows

### First use

1. Open Resurface and read the export instructions in build-generated HTML.
2. Open `https://x.com/i/history` while logged into X and choose the Bookmarks tab, not Likes, and the main list rather than a folder.
3. Choose an export method. Either drag the Export for Resurface bookmarklet to the bookmarks bar and click it in the X tab, or copy the export script from Resurface and paste it into the DevTools Console of the X tab.
4. Keep the X tab open while the exporter runs.
5. Receive a JSON download after a successful export.
6. Return to Resurface and select the JSON file.
7. Review the import counts and confirm that the export represents the complete collection.
8. Persist the collection, create a shuffled cycle, and enter the reader.

### Returning use

1. Open Resurface in the same browser profile and at the same origin.
2. Hydrate the pre-rendered shell and load IndexedDB.
3. Resume the saved current card, or the completion screen if the cycle was completed.
4. Request X's widget and render only the current and nearby cards.

Closing a tab or browser does not normally discard the collection. This is persistence across visits, not offline availability of X content.

### Refreshing bookmarks

1. Run the exporter again on X to generate a fresh snapshot.
2. Import it into Resurface.
3. Review added, removed, retained, and duplicate counts.
4. Confirm completeness and apply the replacement of bookmark membership atomically.
5. Continue the existing cycle under the reconciliation rules below.

## Bookmarklet design

### Reference and legal boundary

The user selected the flow in:

- Repository: `https://github.com/chrislee973/twitter-bookmark-search`
- Inspected revision: `9678cef69e89cda8726a450ece402cf443e6505d`
- Export implementation: `scripts/bookmarks.js`
- Setup UI: `pages/index.vue`

The inspected repository tree contained no license file. Do not copy its implementation without resolving permission. Implement the agreed behavior independently or use appropriately licensed source after review.

The reference script does more than scrape visible cards. It initially scrolls to intercept XHR request headers, then calls X's internal bookmark GraphQL endpoint with the active session and follows pagination. It exports a `version`/`data` object containing rich tweet metadata.

The reference has behaviors we must not inherit:

- Logging session authorization and CSRF headers.
- A hard-coded GraphQL operation URL and feature configuration.
- Falling through from a request error into a successful-looking partial download.
- Leaving request interception or timers active after completion.
- Treating skipped parsing failures as a complete authoritative snapshot.

### Required behavior

- Provide a draggable `javascript:` bookmarklet and readable source for inspection. Also offer the same script for the DevTools Console, with Copy, View, and Select controls, keyboard instructions for opening the Console, and a warning to paste only code the user has reviewed and trusts.
- Keep the payload self-contained. Do not inject remotely hosted scripts, import modules, or call Resurface from inside X.
- Maintain one readable source implementation and derive the bookmarklet payload during the build. The Console script is decoded from that same payload. Do not maintain a separate hand-edited minified copy.
- Account for React/browser handling of `javascript:` links when presenting the draggable bookmarklet. Never use imported content to construct executable code.
- Run only on the main X bookmarks page: origin `https://x.com` and path exactly `/i/history`, with an optional trailing slash. Do not run on `/i/bookmarks`, `twitter.com`, or subpaths such as folders or other history tabs. Capture only the Bookmarks GraphQL operation, so Likes or another type of timeline can't be exported as a snapshot.
- Show a progress indicator and useful error messages in the X tab.
- Capture the current bookmark request so the operation URL, required query parameters, and relevant session headers come from X's active session rather than copied constants.
- Accommodate the actual request mechanism used by X, whether XHR or fetch. Do not assume the reference's XHR-only hook is still sufficient.
- Use the captured bookmark request to fetch successive bookmark pages within X. Only make read requests needed for this export.
- Keep authorization and CSRF values in the X tab's transient memory. Never log them, serialize them, persist them, put them in the URL, or send them outside the necessary X requests.
- Extract only the bookmarked parent post's string ID. Do not accidentally include a quoted post, promoted content, or unrelated timeline entries.
- Deduplicate IDs while preserving collection order in the exported array.
- Derive pagination termination from the current response protocol, not a fixed result count or a short page alone.
- Treat rate limits, authentication errors, unexpected response structures, repeated/non-progressing cursors, and extraction errors as failures unless the current protocol explicitly identifies normal completion.
- Live use showed that X's bookmark list can send a page with no bookmarks that still has a cursor. Follow such empty pages, up to a fixed number in a row, and fail after that. End normally only on a bottom TimelineTerminateTimeline instruction, an empty page with no Bottom cursor, or an empty page whose Bottom cursor equals the cursor just requested. Open-source bookmark exporters (gallery-dl) use the last rule. A page with bookmarks but no new IDs, or a reused earlier cursor, is still a failure.
- A valid cursor or entry identifier may permit retaining the ID of an otherwise unavailable bookmarked post. If membership cannot be determined, do not silently skip that entry and declare a complete snapshot.
- On failure, do not produce a successful complete snapshot. Explain the issue and allow retry or cancellation without silently saving a partial collection.
- Prevent duplicate concurrent runs in the same X tab.
- Clean up request interception, timers, event listeners, UI, object URLs, and in-memory credentials when finished or cancelled. Restore only hooks owned by this invocation.
- Do not ask the user to disable browser security controls.

### Completeness limitation

Even successful pagination cannot prove that X exposed every historical bookmark. The export status means that the exporter completed its supported traversal without a known failure. It is not a guarantee about X's underlying data.

A logged-out page, failed request, or unrecognized response must never become an empty successful export. A genuinely empty collection needs an affirmative empty-timeline response understood by the exporter.

Current X compatibility is an implementation prerequisite. The reference source was inspected but not executed, and its present-day functionality has not been established. If the agreed approach cannot work reliably in the target browsers, stop and discuss the blocker with Rohit rather than substituting an extension, paid API, backend, or credential-sharing workaround.

## Snapshot data contract

Use one format shared by the bookmarklet and importer. A proposed v1 contract is:

```json
{
  "kind": "resurface-bookmark-snapshot",
  "version": 1,
  "exportedAt": "2026-01-01T12:00:00.000Z",
  "status": "complete",
  "count": 2,
  "bookmarks": [
    { "id": "1234567890123456789" },
    { "id": "1234567890123456790" }
  ]
}
```

- `kind` distinguishes snapshots from unrelated JSON.
- `version` is the schema version, not the bookmarklet's package version.
- `exportedAt` is the export completion time in ISO 8601 format.
- `status` must be `complete` for import eligibility. This does not bypass the user's completeness confirmation.
- `count` equals the number of records in `bookmarks` before importer deduplication. Our own exporter emits unique records, so normally it also equals the unique count.
- `id` is a nonempty string of decimal digits representing a post ID. Never parse tweet IDs as JavaScript numbers or try to repair already-rounded numeric IDs.
- No tweet text, user profile, media URLs, cookies, or session credentials are included.
- Imported strings are data, never HTML or executable source.

Keep the contract and its version in one source of truth. The importer can tolerate harmless extra metadata, but must reject unknown schema versions and structurally invalid required fields rather than guessing another format.

## Import and reconciliation

### Preparation and confirmation

- Read and validate the entire file before mutating stored state.
- Invalid JSON, unsupported versions, incomplete exports, invalid IDs, count inconsistencies, and malformed records leave existing data untouched.
- Do not skip malformed records and then reconcile the surviving subset.
- Deduplicate valid repeated IDs and report duplicates separately.
- Show the snapshot export time and counts for added, removed, retained, and duplicate records.
- Require explicit confirmation that the file represents the complete current collection.
- If a snapshot is older than the last imported snapshot, warn that applying it can restore old membership. Do not imply it is a fresh synchronization.
- Empty imports and large removals need prominent destructive-change warnings. Require an additional explicit acknowledgement for clearing the collection.
- Allow cancellation without saving any part of the import.
- Recompute the final change against the latest persisted state when committing so a stale preview does not overwrite intervening local changes unnoticed.

### Membership rules

| Condition | Result |
| --- | --- |
| ID in import but not local collection | Add it |
| ID in both | Retain it and its cycle progress |
| ID local but absent from import | Remove it from collection and cycle state |
| Duplicate ID in import | Keep one membership record |
| Identical imported membership | Do not reorder or restart the cycle |

Use a single IndexedDB transaction for collection replacement, reconciled cycle state, and import metadata. Show success only after the transaction completes. A failure keeps the previously committed state usable.

The user operates one collection per browser profile. Explain that importing a different X account replaces the same collection. Provide Reset collection rather than an account-management system.

## Shuffle and navigation rules

### Durable cycle model

Keep these concepts distinct:

- The ordered unique IDs in the current cycle.
- Which IDs have been passed/viewed in that cycle.
- Which card is currently being displayed.
- Whether the reader is displaying a completed-cycle state.

The viewing cursor is not the viewed count. Going back must not undo progress. Derive counts from the canonical cycle state instead of persisting competing counters.

A small persisted cycle record can contain ordered IDs, viewed IDs, the current ID, and a completion marker. Use the simplest equivalent representation that satisfies the rules. No lifetime reading history or multiple historical cycles are required.

### Starting and advancing

- On the first nonempty import, shuffle all unique bookmark IDs without replacement.
- Save the order and initial current card. Reloading does not reshuffle.
- Moving forward past the current card marks it viewed for that cycle.
- A timer, embed load, video playback, tab close, or merely seeing a card does not mark it viewed.
- Moving backward does not mark the departing card viewed and does not undo previously viewed cards.
- Advancing through an already-viewed card does not count it twice.
- Later, available only on the first unviewed card while another unviewed card remains, moves that card to a random spot after the next card. It does not mark it viewed or change progress.
- The current card persists even when it is a revisited card.
- At the forward end of the sequence, present the completion screen. Do not automatically start another cycle.
- Shuffle again explicitly creates a fresh cycle from the current collection and resets per-cycle viewed state.
- Empty collection and completed nonempty cycle are different UI states.

### Imports during a cycle

- Preserve the relative order and viewed state of retained IDs.
- Remove missing IDs from the order, viewed state, and current pointer.
- Mix newly added IDs into the remaining unviewed portion at random positions.
- Preserve the current card if it still exists. Do not insert new cards before that current unviewed card or disturb the currently displayed card.
- When the user is revisiting an earlier viewed card, insert new IDs into the unviewed portion, not into the historical viewed portion.
- If the current ID is removed, select the next surviving unviewed ID from the reconciled sequence. If none exists, show completion unless the collection is empty.
- If a completed cycle receives new IDs, resume with those new IDs only. Retained viewed IDs do not repeat until Shuffle again.
- Removing an ID discards its cycle state. If a later snapshot adds it again, it is new.
- If the file has no membership changes, retain the exact queue and current position.

All wheel, button, and keyboard navigation must use the same transition logic. Persist transitions promptly; do not rely on an unload callback to save progress.

## Reader and X embeds

### Layout

- Dark shell, dark X card theme, restrained controls, centered reading column, and system fonts.
- One reel panel per bookmark, with at least viewport height where practical.
- A long card can make its panel taller than the viewport. Let the user read the whole card before scrolling into the next panel.
- Do not crop tweet content, scale it down to unreadable text, or trap it inside a fixed-height nested scroller.
- Keep Previous/Next controls outside X's frame. Show cycle progress as a compact `N of M` (viewed of collection size) with an accessible label, without deriving progress from the current index alone.
- Expose Import bookmarks (back to the home page with export instructions and import) without adding a separate browse mode. Do not add an Open on X control; X's own card links to the post.
- Use accessible labels, visible focus states, and reduced-motion behavior for the app-owned UI.

### Embed integration

- Use X's official `widgets.js` and `twttr.widgets.createTweet` integration.
- Supply string tweet IDs. X supplies the card, supported photos, and native video player.
- Use dark theme, visible media, and `dnt: true`. Hide parent conversation context if supported so a bookmarked reply does not expand unrelated preceding content unnecessarily.
- Load the widget once, only when the reader needs it. Render the current and a small bounded set of adjacent cards rather than all bookmarks.
- Clean up stale cards on navigation and ignore async results belonging to a removed container or an old import.
- Do not overlay a navigation catcher over the card: links, images, and video controls must remain usable.
- Cross-origin frames can consume keyboard and wheel events. Do not promise that arrow keys or scrolling over every point of the embed will navigate Resurface. Keep app-owned navigation usable outside the frame.
- Scrolling through long content must not advance before the user reaches the panel boundary. Avoid momentum causing several accidental forward transitions.
- Offscreen videos must not continue indefinitely. Prefer removing distant embeds instead of retaining hidden players. Do not promise a playback-control API the official widget does not expose.

### Loading and failures

- Show loading UI while the official widget is being requested or rendering.
- Use a bounded timeout and handle rejected or unresolved widget loading. Do not rely solely on undocumented promise behavior for unavailable posts.
- On failure, show a neutral message, Retry, Later when allowed, and Next.
- A failed render is not proof of deletion. It may be a blocker, network problem, restriction, or unavailable post.
- Never remove collection membership because an embed fails.
- Passing a failed card counts as passed for that cycle, with no separate retry queue.
- Explain Brave Shields or other blocker interference without disabling protections automatically.

## Persistence and privacy

- IndexedDB is the source of truth for durable application state.
- Use a small helper such as `idb` if it reduces transaction and upgrade complexity. Avoid a general repository/service stack around a single local database.
- Store the collection and cycle together in the same database. Atomic reconciliation must span all affected records.
- Keep only metadata needed for current behavior, such as schema version and last import time/count.
- Namescope the database to Resurface. Browser storage is origin-scoped, not repository-path-scoped, which matters on GitHub Pages.
- Request persistent storage where supported, but handle denial without claiming storage is guaranteed.
- Opening the site normally in the same browser profile restores state. Clearing site data, private browsing, eviction, or moving to a different origin can lose or isolate it.
- If storage is unavailable or writes fail, show an actionable error. Never report that progress/import was saved when it was not.
- Avoid silently allowing two tabs to overwrite one another's cycle state. Choose a simple single-active-reader guard or stale-state reload behavior rather than adding collaborative synchronization.
- Reset collection requires explicit confirmation and clears bookmarks, cycle state, and import metadata.
- No Resurface analytics, telemetry, external fonts, or cloud uploads.
- Imports remain local and must never be committed to the repository or included in build output.
- Official embeds load automatically when entering the reader. Explain during onboarding that rendering contacts X.
- `dnt: true` limits some X personalization uses; it is not a promise of anonymity or zero tracking.
- The exporter uses the current X session only within the X tab. Resurface itself does not receive session credentials.

## Build and application architecture

### Chosen stack

- React and TypeScript.
- Vite, with no application framework. A small build-time renderer pre-renders the single page.
- Plain CSS.
- ESLint with typescript-eslint and React hooks rules (`npm run lint`). No formatter.
- IndexedDB, optionally through `idb`.
- GitHub Actions and GitHub Pages.

Pin mutually compatible package versions during implementation after reading current official documentation. Do not copy outdated configuration blindly.

### Static HTML and hydration

- Generate real HTML at build time for the title, explanation, export instructions, import area, and empty/storage-loading shell.
- Do not deliver only an empty root element and call that pre-rendering.
- Render the real application at build time with React's server renderer. `src/server.tsx` is built with `vite build --ssr`, and `prerender.js` writes its markup inside the empty `<div id="root"></div>` of the built `dist/client/index.html`. The build fails unless the page contains exactly one empty root.
- Hydrate the same React application in the browser with `hydrateRoot`. The user explicitly chose this over a static-islands architecture.
- Production must never fall back to rendering an empty root in the browser, and hydration errors must not be hidden behind fallbacks.
- The development server serves an empty root and renders with `createRoot`. Development therefore does not exercise pre-rendering or hydration; use the production build and preview for that.
- Keep React's server rendering code out of the browser bundle. Do not add development SSR middleware.
- The build has no access to the user's IndexedDB or private bookmarks. Generate no personal feed content at build time.
- Keep the first browser render compatible with the generated HTML, then read storage and switch to the correct app state after hydration.
- Do not access `window`, `document`, IndexedDB, or the X widget at module initialization during pre-rendering.
- Generate the bookmarklet payload at build time without executing it against X.
- Load the interactive feed code separately when needed and request X's widget only for the reader.
- Pre-rendering alone does not reduce the React runtime. Keep dependencies small and avoid unnecessary framework features to meet the user's bundle-size motivation.
- Runtime hosting must contain only static artifacts. Build-time/server-rendering tooling does not imply a deployed server.

### Suggested responsibilities

Keep the exact file layout modest:

- Public page (`index.html`), browser entry, and app shell with top-level view state.
- Build-time renderer: the SSR entry and the script that writes its HTML into the built page.
- Exporter readable source and generated payload (bookmarklet and Console script).
- Snapshot contract, parsing, and import preview.
- Pure membership reconciliation and shuffle transitions.
- IndexedDB open/upgrade/transaction operations.
- Reader layout and official embed lifecycle.
- Shared CSS and GitHub Pages configuration.

No duplicate data models in UI components. No queue logic scattered between input handlers. No wrappers that merely repeat every method of the underlying storage helper.

Use in-app views for onboarding, reader, completion, and settings. Settings is reached through the `#settings` hash; there is no need for deep routes in v1.

First-party source and config files carry no comments. Prefer descriptive names, and keep explanations in README.md and this document. Third-party files keep their own text and license notices.

## GitHub Pages deployment

- Prepare a workflow that builds and publishes static output on pushes to `main` once the repository and Pages settings are configured.
- This is not authorization for an agent to push or initiate a deployment without asking.
- Target project hosting at `/resurface/`, without a custom domain initially.
- Configure both page and asset base paths through Vite's `base` setting.
- Publish only the generated static client artifact, not source credentials, local exports, build-time server output, or private browser data.
- Keep the app at a single public entry page to avoid relying on a server rewrite fallback.
- Document repository Pages setup and the deployed URL in the README.
- Use current official GitHub Actions deployment guidance and appropriate minimal workflow permissions.

## Implementation sequence

1. **Establish exporter compatibility.** Independently implement the self-contained bookmarklet against the current X request/pagination behavior, respecting the reference licensing boundary. Treat failure of this approach as a discussion point rather than silently changing the agreed product.
2. **Create the static application foundation.** Set up Vite, React, TypeScript, a small build-time renderer for real HTML, hydration, plain dark CSS, and `/resurface/` base-path configuration. Keep all personal state browser-only.
3. **Implement the snapshot and storage core.** Define the shared format, strict import preparation, IndexedDB state, and atomic membership/cycle reconciliation.
4. **Implement durable shuffle behavior.** Centralize forward/back transitions, current position, viewed state, new-ID insertion, current-card removal handling, and completion behavior.
5. **Build the reel reader.** Integrate official X cards, bounded nearby rendering, long-card scrolling, accessible navigation, and failure actions.
6. **Connect onboarding and management.** Add exporter instructions for both methods, file selection, reconciliation preview, destructive acknowledgements, storage/privacy information, and confirmed reset.
7. **Prepare the handoff and deployment files.** Add the README and GitHub Pages workflow without committing, pushing, or deploying without permission.

## Known limitations and non-promises

- X's internal API is undocumented and can change. Query discovery, response parsing, or authentication behavior may require future maintenance.
- Exporting many pages can encounter rate limits. Do not promise a fixed completion time or immunity from X restrictions.
- An apparently successful export can still reflect only the collection X exposed. Missing IDs are removed only after user confirmation of completeness.
- This plan does not guarantee that the approach is endorsed by X or free of account/platform-policy risk. Do not describe it that way in onboarding.
- X controls embedded post layout, availability, supported media, and playback behavior.
- Protected, deleted, suspended-account, sensitive, or otherwise restricted posts may not render.
- A link to an external video is not necessarily an inline playable video.
- Embedded cards need internet access. Stored IDs are not an offline archive.
- Browser storage is not a cross-device sync mechanism or permanent backup.
- Pre-rendered HTML cannot contain the user's private collection and does not eliminate client JavaScript.

## Research references

- Export-flow reference: https://github.com/chrislee973/twitter-bookmark-search
- Reference export source at inspected revision: https://github.com/chrislee973/twitter-bookmark-search/blob/9678cef69e89cda8726a450ece402cf443e6505d/scripts/bookmarks.js
- Reference onboarding at inspected revision: https://github.com/chrislee973/twitter-bookmark-search/blob/9678cef69e89cda8726a450ece402cf443e6505d/pages/index.vue
- X widget factory documentation: https://docs.x.com/x-for-websites/embedded-posts/guides/embedded-post-javascript-factory-function
- X embed parameters: https://docs.x.com/x-for-websites/embedded-posts/guides/embedded-tweet-parameter-reference
- Browser storage quotas and eviction: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- Persistent storage request: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
- GitHub Pages overview: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Vite server-side rendering guide (client and SSR builds): https://vite.dev/guide/ssr
- Vite public base path: https://vite.dev/guide/build#public-base-path
- React `hydrateRoot`: https://react.dev/reference/react-dom/client/hydrateRoot
- React `renderToString`: https://react.dev/reference/react-dom/server/renderToString

Official X embed documentation was retrieved through find-docs. Direct Exa fetches of those pages were unavailable. The Vite SSR guide and React's `hydrateRoot` and `renderToString` references were consulted through find-docs for the revised build. Reference repository source was retrieved and inspected without running it.
