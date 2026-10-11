# Ted's Tools

Personal dashboard for tools, notes and links — built with Next.js (App Router) and Tailwind CSS. Sections: Tools, Text Tools, Color Tools, Assets Tools, Notes, Links, Static Pages and Live Log.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Go to https://vercel.com/new and import the repo.
3. Vercel auto-detects Next.js — no config needed. Click **Deploy**.

Or from the CLI:

```bash
npm i -g vercel
vercel
```

## Live Log

`/livelog` shows a realtime log stream from other projects: they load the
standalone SDK (`/livelog.js`) and call `LiveLog.info(...)`, and the line appears
on the page within a frame.

Nothing is stored — no database, no Redis, no disk. Logs exist only in the
realtime server's memory and in the open page, so a restart or a refresh loses
them.

That realtime half is a **separate deployable**: Vercel cannot host it, because
its serverless functions can neither hold a WebSocket open nor share memory
between invocations. `public/livelog-server/` is one long-lived Node process that
takes logs over HTTP and broadcasts them over WebSocket, deployed on its own
(Fly.io by default). It lives in `public/` so the page can hand out a zip of it —
the **Server** button on `/livelog` downloads it, and the same dialog takes a
server address at runtime, so pointing the page somewhere new needs no rebuild
and no environment variables. See [docs/LIVE-LOG.md](docs/LIVE-LOG.md) for the
SDK, the architecture and the variables, and
[public/livelog-server/README.md](public/livelog-server/README.md) for hosting it.

## Project structure

```
app/
  layout.js        root layout, renders the sidebar + page content
  page.js           `/` redirects to /tools (no Home view)
  tools/page.js     Tools view (UUID, timestamp, diff, event timeline)
  texttools/page.js Text Tools view (JSON, case, trim, Base64, URL, HTML, JWT, ...)
  color/page.js     Color Tools view (picker, palette, contrast, shades, gradient)
  assets/page.js    Assets Tools view (spritesheet slicer, texture packer, viewer)
  notes/page.js     Notes view
  links/page.js     Links view
  statics/page.js   Static Pages view (lists public/static_pages)
  livelog/page.js   Live Log view (realtime log console + channel list)
components/
  Sidebar.js        left nav with collapsible toggle
  Modal.js           shared modal wrapper
  ItemRow.js         note/link row + empty state
  color/             Color Tools panels
  assets/            Assets Tools + shared drop zone / frame overlay / toast
  livelog/           Live Log console, log row and setup/docs modal
lib/
  useHubData.js      data layer (notes, links, color history) — currently localStorage
  tools.js           pure functions powering the Tools + Text Tools pages
  color.js           pure color math
  spritesheet.js     Cocos atlas plist parsing/generation and shelf packing
  zip.js             store-only ZIP writer (no dependency) + download helper
  lunar.js           Vietnamese lunar calendar conversion
  events.js          static holiday list + next-occurrence/countdown logic
  staticPages.js     scans public/static_pages (server-only)
  livelog.js         pure Live Log helpers (formatting, filtering, row offsets)
  useLiveLog.js      Live Log socket hook — reconnect, batching, pause
public/
  static_pages/      standalone HTML pages, one folder or .html file each
  livelog.js         standalone Live Log SDK (window.LiveLog, no dependencies)
  livelog.esm.js     module entry point that re-exports it
  livelog-server/    the Live Log realtime server — deployed on its own, and
                     served from here so /livelog can download it as a zip
                     (see public/livelog-server/README.md)
docs/
  DESIGN.md          design tokens (colors, spacing, type)
  DATA-MODEL.md       data shapes + how to extend/migrate them
  PROMPTS.md           ready-to-paste prompts for common AI-assisted tasks
  LIVE-LOG.md         Live Log SDK, architecture, env vars and deployment
```

## Working with AI on this repo

`CLAUDE.md` at the repo root is written for AI coding assistants (Claude
Code, Cursor, etc.) — point any assistant at it first. `docs/PROMPTS.md`
has ready-to-paste prompts for common tasks (adding a tool, adding an
entity type, wiring up a database, adding auth).

## Data storage today

Notes, links and recent colors are stored in the browser's `localStorage` via
`lib/useHubData.js`.
This means:
- Zero setup, works immediately after deploy.
- Data is per-browser/device — it won't sync across devices or persist if
  the user clears site data.

## Scaling later: swap in a real backend

`useHubData()` is the only place that talks to storage — every page calls its
`notes`, `links`, `addNote`, `removeNote`, `addLink`, `removeLink`. When you're
ready to add a real database, you can keep that same interface and swap the
implementation, so pages/components won't need to change:

1. Add a database. Easiest options on Vercel: **Vercel Postgres**, **Vercel KV**,
   or **Supabase**.
2. Add API routes, e.g. `app/api/notes/route.js` and `app/api/links/route.js`,
   with `GET`/`POST`/`DELETE` handlers.
3. Update `lib/useHubData.js` to `fetch()` those routes instead of reading/writing
   `localStorage` (e.g. with `useEffect` + `fetch` on load, and `fetch(..., { method: "POST" })`
   inside `addNote`/`addLink`).
4. Optional: add auth (e.g. `next-auth`) once there's more than one user, and
   scope notes/links to the signed-in user in the API routes.

## Adding more tools

Tool logic lives in `lib/tools.js` as plain functions, and the tool list/metadata
is in `toolList`. To add a new tool:
1. Write a pure function in `lib/tools.js`.
2. Add an entry to `toolList`.
3. Add a small `<YourTool />` component in `app/tools/page.js` and render it
   when `activeKey === "your-key"`.
