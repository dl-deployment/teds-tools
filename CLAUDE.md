# CLAUDE.md

Guidance for Claude (or any AI assistant) working in this repository.

## What this project is

Ted's Hub — a personal dashboard for a developer: quick-access dev tools
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
  poe/page.js       POE Tools view — Trade / Maker / Exchange / League / Regex / Note / System sections
  poe/actions.js     server action: reads the poe2 league list + stat texts (see lib/poe.js)
  notes/page.js     Notes view
  links/page.js     Links view
  statics/page.js   Static Pages view — server component, scans public/static_pages
components/
  Sidebar.js        left nav, collapsible
  Modal.js           shared modal wrapper — reuse this for any new dialog
  ItemRow.js         NoteRow / LinkRow / TradeConfigRow / EmptyState
  color/             Color Tools panels (swatch, input, palette, contrast, shades, gradient)
  assets/            Assets Tools (slicer, packer, viewer) + Shared.jsx (DropZone, FrameOverlay, Section, toast)
  poe/               POE Tools panels (trade config list + snippet + Maker merge, league picker,
                     Exchange tabs) + NumberField.jsx (commit-on-blur numeric input)
lib/
  useHubData.js      ALL data reads/writes go through this hook
  tools.js           pure functions for the Tools + Text Tools pages
  color.js           pure color math (conversions, palettes, WCAG contrast, shades/tints)
  poe.js             pure trade payload, snippet, Maker merge, Exchange rates and import/export helpers
  spritesheet.js     pure Cocos atlas helpers (plist read/write, shelf packing)
  zip.js             store-only ZIP writer + downloadBlob — no zip dependency
  lunar.js           Vietnamese lunar calendar maths + date formatting
  events.js          static event list for the timeline + processEvents()
  md5.js             vendored pure-JS MD5 (Web Crypto has none)
  staticPages.js     server-only scan of public/static_pages (uses node:fs)
public/
  static_pages/      standalone HTML pages: a folder with index.html, or a loose .html
  poe/               poe2-payloads.json (Trade seed) + poe2-group-stats.json (Maker source)
                     + poe2-exchange-cost.json (Exchange Cost seed) — each tab's
                     Export .json writes its own file back out
docs/
  DESIGN.md          design tokens (colors, spacing, type) — read before touching styles
  DATA-MODEL.md       shape of notes/links + how to add a new entity type
  PROMPTS.md           ready-to-use prompts for common follow-up tasks on this repo
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
   defined in `tailwind.config.js`.
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

## Common follow-up tasks

See `docs/PROMPTS.md` for ready-to-paste prompts for: adding a new tool,
adding a new entity type (like Notes/Links), wiring up a real database,
and adding auth. Skim `docs/DATA-MODEL.md` first if the task touches data.
