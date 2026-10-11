# CLAUDE.md

Guidance for Claude (or any AI assistant) working in this repository.

## What this project is

Ted's Tools — a personal dashboard for a developer: quick-access dev tools
(Tools, Text Tools, Color Tools), notes, and bookmark links, plus Static
Pages for standalone HTML dropped into `public/`. Next.js 14 (App Router),
React, Tailwind CSS. No backend yet — data lives in the browser's
`localStorage`.

Dark theme, single accent-per-section palette (blue/green/purple/orange),
rounded cards, left sidebar nav with a collapse toggle. See
`docs/DESIGN.md` for the exact tokens — keep new UI consistent with them
rather than introducing new colors or radii.

## Commands

```bash
npm install       # install deps
npm run dev        # local dev server, http://localhost:3000
npm run build       # production build — run this before considering a UI change done
npm run lint         # eslint
```

There are no automated tests yet. If you add non-trivial logic (especially
in `lib/`), prefer writing it as a small pure function so it's easy to test
later, and consider adding a test file alongside it.

## Project structure

```
app/
  layout.js        root layout — renders <Sidebar/> + page content
  page.js           `/` has no view of its own — redirects to /tools
  tools/page.js     Tools view — UUID, timestamp, diff, Event Timeline
  texttools/page.js Text Tools view — group list in the sub-sidebar, one text buffer
  color/page.js      Color Tools view — panel list in the sub-sidebar, all color state starts here
  assets/page.js     Assets Tools view — slicer / packer / viewer in the sub-sidebar
  poe/page.js       POE Tools view — Trade / Maker / Exchange / League / System sections
  poe/actions.js     server action: reads the poe2 league list + stat texts (see lib/poe.js)
  notes/page.js     Notes view
  links/page.js     Links view
  statics/page.js   Static Pages view — server component, scans public/static_pages
  livelog/page.js    Live Log view — realtime log console + channel list; the
                     viewer half of the pair described under "Live Log" below
components/
  Sidebar.js        left nav, collapsible
  Modal.js           shared modal wrapper — reuse this for any new dialog
  ItemRow.js         NoteRow / LinkRow / TradeConfigRow / EmptyState
  color/             Color Tools panels (swatch, input, palette, contrast, shades, gradient)
  assets/            Assets Tools (slicer, packer, viewer) + Shared.jsx (DropZone, FrameOverlay, Section, toast)
  poe/               POE Tools panels (trade config list + snippet + Maker merge, league picker,
                     Exchange tabs) + NumberField.jsx (commit-on-blur numeric input)
  livelog/           Live Log console (LogConsole), one row (LogRow) and the setup
                     modal (DocsModal). The level colour classes must stay in
                     LogRow.jsx — see rule 4
lib/
  useHubData.js      ALL data reads/writes go through this hook
  tools.js           pure functions for the Tools + Text Tools pages
  color.js           pure color math (conversions, palettes, WCAG contrast, shades/tints)
  poe.js             pure trade payload, snippet, Maker merge, Exchange rates and import/export helpers
  hub.js             pure helpers for the bundled Notes/Links defaults (parse + build)
  spritesheet.js     pure Cocos atlas helpers (plist read/write, shelf packing)
  zip.js             store-only ZIP writer + downloadBlob — no zip dependency
  lunar.js           Vietnamese lunar calendar maths + date formatting
  events.js          static event list for the timeline + processEvents()
  md5.js             vendored pure-JS MD5 (Web Crypto has none)
  staticPages.js     server-only scan of public/static_pages (uses node:fs)
  livelog.js         pure Live Log helpers (level/format/filter/row-offset maths)
  useLiveLog.js      Live Log socket hook — reconnect, rAF batching, pause, dedupe
public/
  static_pages/      standalone HTML pages: a folder with index.html, or a loose .html
  hub/               notes.json + links.json (Notes/Links seed defaults) — each tab's
                     Export .json writes its own file back out (see lib/hub.js)
  poe/               poe2-payloads.json (Trade seed) + poe2-group-stats.json (Maker source)
                     + poe2-exchange-cost.json (Exchange Cost seed) — each tab's
                     Export .json writes its own file back out
  poe/extension/     MV3 extension that runs a Snippet against the trade API with
                     host permissions (a page fetch would be CORS-blocked). System
                     tab zips it for download; the file list is EXTENSION_FILES in lib/poe.js
  livelog.js         standalone Live Log SDK — zero deps, defines window.LiveLog,
                     and deliberately has no import/export statements
  livelog.esm.js     module entry point: side-effect imports the above and
                     re-exports LiveLog (so both <script> and `import` work)
  livelog-server/    the Live Log realtime server — its own package and deployment
                     (Fly.io/Render/Railway/VPS), separate from Vercel's runtime and
                     never imported by this app. It is served from public/ on purpose
                     so /livelog can download a zip of it, so treat the folder as
                     world-readable (see rule 8)
docs/
  DESIGN.md          design tokens (colors, spacing, type) — read before touching styles
  DATA-MODEL.md       shape of notes/links + how to add a new entity type
  PROMPTS.md           ready-to-use prompts for common follow-up tasks on this repo
  LIVE-LOG.md         Live Log SDK, architecture, env vars and deployment
```

## Rules for changes in this repo

1. **Data access goes through `lib/useHubData.js` only.** Don't read/write
   `localStorage` directly from a page or component. This is what lets the
   storage backend be swapped later (see `docs/DATA-MODEL.md`) without
   touching every page. Static reference data that the user never edits is
   the exception and lives in `lib/` instead (see `lib/events.js`).
2. **Keep tool logic in `lib/` as pure functions** (input in, output out, no
   DOM/state) — `lib/tools.js` for the Tools and Text Tools pages,
   `lib/color.js` for Color Tools, `lib/spritesheet.js` + `lib/zip.js` for
   Assets Tools. Pages and components only wire them to inputs and buttons.
   The exceptions are marked in place: `lib/staticPages.js` uses `node:fs`,
   and `parsePlist` uses `DOMParser`, so both run server/browser-side only.
   Watch the two error conventions: helpers like `convertTimestamp` return an
   error *string* that the page renders as output, while every Text Tools
   transform (`formatJsonPretty`, `toCamelCase`, `jwtDecode`, ...) *throws*
   so the page can raise one error toast. Text Tools owns the JSON and
   Base64 transforms now — the Tools page no longer has its own copies.
3. **Reuse `Modal.js` and `ItemRow.js`** for anything modal- or list-row-
   shaped rather than writing new markup — keeps the UI consistent.
4. **Follow existing Tailwind token usage** (`bg-panel`, `bg-panel2`,
   `border-border`, `text-muted`, `text-accent`/`accent2`/`accent3`/`accent4`,
   `rounded-card`) instead of raw hex values or ad hoc radii. These are
   defined in `tailwind.config.js`. Note that its `content` globs only cover
   `app/` and `components/`, so a class name written anywhere else is never
   generated — the Live Log level palette lives in
   `components/livelog/LogRow.jsx` for exactly that reason, not in `lib/`.
5. **Every page/component that touches `localStorage` or `window` needs
   `"use client"`** at the top (App Router server components can't use
   browser APIs).
6. Before calling a UI change done, run `npm run build` — the app must
   compile cleanly.
7. **Adding a static page needs no code change** — drop a folder containing
   an `index.html` (or a loose `.html` file) into `public/static_pages/` and
   `/statics` lists it. The list is built when the page renders, so a running
   dev server picks new files up on refresh; a deployed build needs a
   redeploy.
8. **Live Log spans two deployables, and none of it is persisted.** `/livelog`
   and the SDK are Vercel-side static/browser code; the socket, the token
   check, the rate limiting and the log buffers live in
   `public/livelog-server/`, which is deployed on its own because Vercel's
   functions can neither hold a WebSocket open nor share memory between
   invocations. So: don't add an `app/api/**` route for it, don't introduce a
   database, Redis or any disk storage, and don't make logs survive a restart —
   they exist only in that one process's memory and in the open page.
   That folder sits under `public/` deliberately: the page serves it so anyone
   can download and run the server (`SERVER_FILES` in `lib/livelog.js` is the
   allowlist the zip is built from), which means **anything put there is
   world-readable** — keep real tokens in `tokens.json`, which is gitignored and
   in `.vercelignore`, and never drop a secret in that folder.
   What `/livelog` remembers — the channels you watch, the server each one lives
   on (a channel can carry its own address, which is how one page watches
   channels on different machines) and the default address, so the endpoint can
   change without a rebuild — goes through `useHubData` like everything else;
   `NEXT_PUBLIC_LIVELOG_*` are only build-time defaults. `docs/LIVE-LOG.md` has the SDK and the deployment story;
   `public/livelog-server/README.md` has the ops side.

## Common follow-up tasks

See `docs/PROMPTS.md` for ready-to-paste prompts for: adding a new tool,
adding a new entity type (like Notes/Links), wiring up a real database,
and adding auth. Skim `docs/DATA-MODEL.md` first if the task touches data.
