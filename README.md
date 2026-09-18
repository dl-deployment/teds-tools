# Ted's Hub

Personal dashboard for tools, notes and links — built with Next.js (App Router) and Tailwind CSS.

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

## Project structure

```
app/
  layout.js        root layout, renders the sidebar + page content
  page.js           Home (dashboard) view
  tools/page.js     Tools view (JSON formatter, Base64, UUID, timestamp, diff)
  notes/page.js     Notes view
  links/page.js     Links view
components/
  Sidebar.js        left nav with collapsible toggle
  Modal.js           shared modal wrapper
  ItemRow.js         note/link row + empty state
lib/
  useHubData.js      data layer (notes & links) — currently localStorage
  tools.js           pure functions powering the Tools page
docs/
  DESIGN.md          design tokens (colors, spacing, type)
  DATA-MODEL.md       data shapes + how to extend/migrate them
  PROMPTS.md           ready-to-paste prompts for common AI-assisted tasks
```

## Working with AI on this repo

`CLAUDE.md` at the repo root is written for AI coding assistants (Claude
Code, Cursor, etc.) — point any assistant at it first. `docs/PROMPTS.md`
has ready-to-paste prompts for common tasks (adding a tool, adding an
entity type, wiring up a database, adding auth).

## Data storage today

Notes and links are stored in the browser's `localStorage` via `lib/useHubData.js`.
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
