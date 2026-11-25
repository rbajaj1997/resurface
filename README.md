# Resurface

Resurface shuffles your X bookmarks and shows them one at a time, so the posts you saved and forgot come back. It remembers where you stopped.

[Open Resurface](https://rbajaj1997.github.io/resurface/). It's free, and there's no account and no server.

<p align="center">
  <img src="docs/images/reader-desktop.png" alt="The Resurface reader showing a NASA post as an X embed, with a 2 of 3 progress count and Previous, Next, and Import bookmarks buttons" width="800">
</p>

X lists bookmarks newest first, so older saves sink out of sight. Resurface puts them in a random order and shows one post per screen. You see every bookmark once before the shuffle starts over.

## Features

- One post per screen, shown with X's official embed, including images and video when X's embed shows them.
- A shuffled order that lasts between visits. Resurface saves your place and counts the posts you've passed.
- Next and Previous buttons, scrolling, and the ← → or K J keys.
- Later, or the L key, for a post you don't have time for. It moves the post to a random later spot in the shuffle without counting it as viewed.
- Import from X with one click in your bookmarks bar. There's no file to download or upload.
- Re-import whenever you like. New bookmarks are mixed into the part of the shuffle you haven't seen, and bookmarks you removed on X drop out.
- A preview before every import that counts new, kept, and removed bookmarks. Nothing changes until you confirm.
- Your collection stays in your browser. Resurface has no account, no server, and no analytics.

<p align="center">
  <img src="docs/images/reader-mobile.png" alt="The Resurface reader in a narrow window, with the post above the controls" width="300">
</p>

## Get started

Use desktop Chrome, Edge, or Brave, logged in to X in the same browser profile.

1. On the [Resurface home page](https://rbajaj1997.github.io/resurface/), drag Send to Resurface to your bookmarks bar. You only do this once. ⌘+Shift+B on a Mac, or Ctrl+Shift+B, shows the bar.
2. Click Open X bookmarks. Your X bookmarks open in a new tab.
3. In that tab, click Send to Resurface in your bookmarks bar. It reads your bookmarks, sends the post IDs to Resurface, and closes the tab.
4. Back in Resurface, check what the import adds and removes, confirm it's your complete collection, and click Apply import. The reader opens.

<p align="center">
  <img src="docs/images/import-preview.png" alt="The import preview showing 3 new, 0 kept, and 0 removed bookmarks, with a confirmation checkbox and Apply import" width="800">
</p>

To pick up new bookmarks later, repeat steps 2 to 4. Your shuffle continues where you left it.

Send to Resurface only works in an X tab opened from Open X bookmarks. Clicked anywhere else, it stops without sending anything.

## Privacy

- Resurface is a static site with no backend. Your collection is a list of post IDs and your place in the shuffle, stored in your browser's IndexedDB.
- Send to Resurface runs in your X tab with your current login. Your login stays in that tab and goes only to X. The post IDs go only to the Resurface tab that opened X.
- Each post card is an X embed, so loading it contacts X. Resurface asks X not to use the embeds for personalization, but X still sees the requests.
- Resurface loads no analytics and no external fonts.
- Settings has Reset collection. It removes your collection and progress from Resurface, not from X.

## Before you use it

- Send to Resurface uses X's undocumented internal API, the same one x.com uses. X doesn't endorse Resurface and can change, rate-limit, or block that API at any time. Resurface can't promise that using it carries no risk to your X account.
- An import holds the bookmarks X returned. Resurface can't check it against your full bookmark history.
- If you already scrolled to the end of your bookmarks, reload the page before you click Send to Resurface.
- Deleted, protected, or restricted posts may not show. Blockers such as Brave Shields can stop the cards from loading.
- The cards need a network connection. The saved IDs aren't an offline archive.
- Browser storage isn't a backup or a sync service. Clearing site data, a private window, or another browser profile starts an empty collection, and your collection doesn't follow you to other devices.
- Resurface supports desktop Chrome, Edge, and Brave. The reader fits a narrow window, but Send to Resurface needs a desktop browser with a bookmarks bar.

The screenshots show the live site with a three-post demo collection of public posts from [@NASA](https://x.com/NASA) and [@jack](https://x.com/jack). They aren't anyone's real bookmarks, and neither account is affiliated with Resurface.

## Run it locally

Resurface uses Vite, React, and TypeScript with plain CSS.

```sh
npm install
npm run dev
npm run build
npm run preview
npm run lint
```

- `npm run dev` serves http://localhost:5173/resurface/.
- `npm run build` pre-renders the home page and writes the static site to `dist/client`.
- `npm run preview` serves `dist/client`.

Send to Resurface's readable source is `bookmarklet/export.js`. The build minifies it into the bookmarklet link. `src/snapshot.ts` defines the message it sends to Resurface.

## Deploy your own copy

`.github/workflows/pages.yml` builds the site and publishes `dist/client` to GitHub Pages on every push to `main`. In your repository, set Settings > Pages > Source to GitHub Actions. The site expects the path `/resurface/`. If your repository has another name or you use another host, change `site` in `vite.config.ts`. It sets the base path and the only address Send to Resurface sends bookmarks to.

## Contributing

Write commit messages as [Conventional Commits](https://www.conventionalcommits.org/), for example `fix: keep the reader position after import` or `docs: clarify export steps`. Product decisions and their reasons are in [plans/PLAN.md](plans/PLAN.md).
