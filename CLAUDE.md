# CLAUDE.md

Guidance for Claude (or any AI assistant) working in this repository.

## What this project is

Ted's Hub — a personal dashboard for a developer: quick-access dev tools,
notes, and bookmark links. Next.js 14 (App Router), React, Tailwind CSS.
No backend yet — data lives in the browser's `localStorage`.

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
  page.js           Home (dashboard) view
  tools/page.js     Tools view
  notes/page.js     Notes view
  links/page.js     Links view
components/
  Sidebar.js        left nav, collapsible
  Modal.js           shared modal wrapper — reuse this for any new dialog
  ItemRow.js         NoteRow / LinkRow / EmptyState
lib/
  useHubData.js      ALL data reads/writes go through this hook
  tools.js           pure functions for the Tools page (formatJson, base64Encode, ...)
docs/
  DESIGN.md          design tokens (colors, spacing, type) — read before touching styles
  DATA-MODEL.md       shape of notes/links + how to add a new entity type
  PROMPTS.md           ready-to-use prompts for common follow-up tasks on this repo
```

## Rules for changes in this repo

1. **Data access goes through `lib/useHubData.js` only.** Don't read/write
   `localStorage` directly from a page or component. This is what lets the
   storage backend be swapped later (see `docs/DATA-MODEL.md`) without
   touching every page.
2. **Keep tool logic in `lib/tools.js` as pure functions** (input in, string
   out, no DOM/state). The Tools page just wires them to a text box and a
   button. This keeps them easy to reuse or test.
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

## Common follow-up tasks

See `docs/PROMPTS.md` for ready-to-paste prompts for: adding a new tool,
adding a new entity type (like Notes/Links), wiring up a real database,
and adding auth. Skim `docs/DATA-MODEL.md` first if the task touches data.
