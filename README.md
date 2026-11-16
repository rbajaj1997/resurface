# Resurface

Resurface shows your X bookmarks one at a time, in a shuffled order, so you can revisit the ones you forgot. It is a static site with no backend. Your collection stays in your browser.

## How it works

1. The exporter runs in your logged-in tab on `https://x.com/i/history` with the Bookmarks tab selected, not Likes. It runs nowhere else: not on `/i/bookmarks`, folders, other history tabs, or `twitter.com`. It copies X's own bookmark timeline request, pages through it, and downloads a JSON file of post IDs.
2. You start the exporter in one of two ways, chosen on the Resurface home page. Both run the same compiled script:
   - **Bookmarks bar.** Drag the Export for Resurface link to the bookmarks bar, then click it in the X tab.
   - **DevTools Console.** Copy the script from Resurface (or open View script and select it), open the Console in the X tab, paste, and press Enter. The browser may ask you to allow pasting first.
3. You import the file into Resurface. Resurface shows what will be added and removed, and asks you to confirm that the file is your complete collection.
4. Resurface stores the IDs and a shuffled order in IndexedDB and shows each post with X's official embed. It remembers which cards you have passed and where you stopped.

Run the exporter again later and import the new file to pick up new bookmarks and drop removed ones. The current shuffle continues: new bookmarks join the part you haven't seen yet.

## Pages

- **Home** has the export instructions and the import area. It shows a Back to reader button when a collection is saved.
- **Reader** shows one post per screen with Previous and Next, a compact `N of M` progress count, and Import bookmarks, which returns to Home. You also move by scrolling, or with ← → or K J while the post isn't focused. Resurface has no Open on X control; X's own card links to the post.
- **Settings** (`#settings`, linked from the Home footer) has the storage and privacy notes and Reset collection. Reset is disabled while no collection is saved.

Resurface targets desktop Chrome, Edge, and Brave.

## Snapshot format

```json
{
  "kind": "resurface-bookmark-snapshot",
  "version": 1,
  "exportedAt": "2026-01-01T12:00:00.000Z",
  "status": "complete",
  "count": 2,
  "bookmarks": [{ "id": "1234567890123456789" }, { "id": "1234567890123456790" }]
}
```

`src/snapshot.ts` defines the format. The build reads `kind` and `version` from there into the exporter script. The importer rejects any file with another kind or version, a status other than `complete`, a wrong count, or an ID that is not a string of digits.

## Project layout

- `index.html` is the single page: title, description, an inline icon, and an empty `<div id="root"></div>`.
- `src/main.tsx` is the browser entry. It hydrates the pre-rendered HTML in production and renders from scratch on the dev server.
- `src/server.tsx` renders `App` to an HTML string at build time. `prerender.js` puts that string inside the empty root of the built `index.html`.
- `src/App.tsx` is the app shell. It holds the stored state, the one-tab lock, and the choice between Home, Reader, and Settings (from the `#settings` hash).
- `src/Manage.tsx` is Home: both export methods and the import preview.
- `src/Settings.tsx` is Settings: storage and privacy notes and Reset collection.
- `src/Reader.tsx` is the reel. `src/Post.tsx` loads X's `widgets.js` and renders one embed.
- `src/cycle.ts` has the shuffle, navigation, and import reconciliation rules as pure functions.
- `src/db.ts` reads and writes the single IndexedDB record.
- `bookmarklet/export.js` is the readable exporter source. `vite.config.ts` minifies it into the `javascript:` link at build time, and Home decodes that same link into the script offered for the Console.
- `.pi/skills/impeccable/` is the Impeccable UI design skill for Pi, copied as plain Markdown without its engine. Its `ORIGIN.md` gives the upstream revision, license, and local changes.

## Development

The stack is Vite, React, and TypeScript with plain CSS. There is no framework or server.

```sh
npm install
npm run dev
npm run build
npm run preview
npm run lint
```

- `npm run dev` serves http://localhost:5173/resurface/.
- `npm run build` writes the static site to `dist/client`.
- `npm run preview` serves `dist/client`.
- `npm run lint` runs ESLint over `src`, the build scripts, the config, and the exporter.

`eslint.config.js` applies ESLint's and typescript-eslint's recommended rules to every `.js`, `.ts`, and `.tsx` file, and React's hooks rules to `src`. The exporter is linted as a browser script, with `SNAPSHOT_KIND` and `SNAPSHOT_VERSION` declared as read-only globals because the build fills them in. The root `.js` files are linted as Node modules. TypeScript stays on 6.x because typescript-eslint doesn't support TypeScript 7 yet.

First-party source and config files have no comments. Explanations live in this README and in `PLAN.md`. Third-party files under `.pi/` keep their own text and license notices.

`npm run dev` renders in the browser only: the dev server sends `index.html` with an empty root. Pre-rendering happens only in `npm run build`, in three steps:

1. `vite build --outDir dist/client` builds the browser bundle, the CSS, and `dist/client/index.html`.
2. `vite build --ssr src/server.tsx --outDir dist/server` builds the render function for Node. It is not published.
3. `node prerender.js` renders `App` with React's `renderToString` and puts the markup inside the empty `<div id="root"></div>` of `dist/client/index.html`. The published page therefore contains the title, export instructions, and import area as HTML, and React hydrates it. If the built page doesn't contain exactly one empty root, the build fails.

The pre-rendered HTML never contains a collection; the build has no access to anyone's browser storage. Use `npm run preview` to check the production page, including hydration.

## Deploying to GitHub Pages

The site is set up for a project page at `https://<user>.github.io/resurface/`. The base path is `base` in `vite.config.ts`. Change it if the repository has another name.

1. Commit `package-lock.json` (created by `npm install`). The workflow runs `npm ci`, which needs it.
2. In the repository, open Settings, then Pages, and set Source to GitHub Actions.
3. Push to `main`. `.github/workflows/pages.yml` builds the site and publishes `dist/client`.

## Limitations

- The exporter uses X's undocumented internal API. X can change it, rate-limit it, or block it at any time. X has not endorsed this tool.
- The exporter has had only limited live use. It assumes X's web app makes the bookmark request through `window.fetch` or `XMLHttpRequest` while the exporter watches, that replaying the copied headers (including any per-request `x-client-transaction-id`) is accepted, and that bookmark entries are named `tweet-<id>` with `Bottom` cursor entries.
- X doesn't document how its bookmark list ends. The exporter finishes when X sends a `TimelineTerminateTimeline` instruction toward the bottom, a page with neither bookmarks nor a `Bottom` cursor, or an empty page whose cursor points back at the one just requested. Open-source bookmark tools such as gallery-dl treat that last case as the end of the list. Empty pages with a fresh cursor can appear before the end, so the exporter follows up to 10 in a row. After that it stops with an error, saves no file, and Retry follows them further. It also stops with an error if a page with bookmarks brings no new ones, or if X reuses an earlier cursor.
- A finished export contains the bookmarks X returned. Resurface can't check that against your full history.
- The exporter needs X to send a bookmark request while it watches. If you already scrolled to the end of your bookmarks, reload the page first. On the Likes tab no bookmark request happens, so the exporter stops with an error. An empty bookmark collection exports only if X sends that request and then a terminal response. Otherwise use Reset collection in Settings.
- Some browsers block pasting into the DevTools Console until you allow it. Only paste a script you have read and trust into a logged-in tab.
- X controls how embeds look and which posts render. Deleted, protected, or restricted posts may not show. Blockers such as Brave Shields can stop embeds from loading.
- Embeds need a network connection. The stored IDs are not an offline archive.
- Browser storage isn't a backup or a sync service. Clearing site data, private windows, or another browser profile starts from an empty collection.
