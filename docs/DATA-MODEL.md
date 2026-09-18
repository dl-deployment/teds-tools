# Data model

## Current shape (localStorage, via `lib/useHubData.js`)

```ts
type Note = {
  id: string;        // cryptoId() — random base36 string
  title: string;
  body: string;       // may be empty
  tag: string;         // may be empty, single free-text tag
  date: string;         // pre-formatted display date, e.g. "Sep 18, 2026"
};

type Link = {
  id: string;
  name: string;
  url: string;          // stored as typed; https:// is assumed at render time if missing
  date: string;
};

type DB = {
  notes: Note[];
  links: Link[];
};
```

Everything is stored as one JSON blob under `localStorage["teds-hub-data"]`.
A one-time seed (`teds-hub-seeded` flag) inserts a welcome note and two
example links on first run, only if both lists are empty.

Data saved under the pre-rename `teds-hub-data` / `teds-hub-seeded` keys is
moved across once, on the first load after the rename — see
`migrateLegacyKeys()` in `lib/useHubData.js`.

## The hook contract

`useHubData()` returns:

```js
{
  ready,        // bool — false until localStorage has been read (avoids SSR mismatch)
  notes, links,  // arrays, as above
  addNote({ title, body, tag }),
  removeNote(id),
  addLink({ name, url }),
  removeLink(id),
}
```

Pages only ever call this hook — never `localStorage` directly. This is the
seam to change when moving to a real backend.

## Adding a new entity type (e.g. "Snippets")

1. Extend `DB` in `lib/useHubData.js`: add `snippets: []` to `emptyDB()`.
2. Add `addSnippet` / `removeSnippet` following the existing `addNote`/
   `removeNote` pattern (validate required fields, generate `id` + `date`,
   `persist({ ...db, snippets: [...] })`).
3. Return the new fields/functions from the hook.
4. Add `app/snippets/page.js` (copy `app/notes/page.js` as a starting point),
   a `SnippetRow` in `components/ItemRow.js`, and a nav entry in
   `components/Sidebar.js`.
5. Add a stat card for it on `app/page.js` if it should appear on Home.

## Moving from localStorage to a real database

Keep the hook's return shape identical so no page/component needs to change.

1. Add a database (Vercel Postgres, Vercel KV, or Supabase are the easiest
   fits for a Vercel deploy).
2. Add API routes: `app/api/notes/route.js` (`GET`, `POST`), `app/api/notes/[id]/route.js`
   (`DELETE`), same for `links`.
3. Rewrite `lib/useHubData.js` internals:
   - On mount, `fetch("/api/notes")` and `fetch("/api/links")` instead of
     reading `localStorage`, set `ready` once both resolve.
   - `addNote`/`addLink` become `fetch(..., { method: "POST", body: JSON.stringify(...) })`
     then update local state with the server's response (so the real `id`
     comes from the DB, not `cryptoId()`).
   - `removeNote`/`removeLink` become `fetch(..., { method: "DELETE" })`.
4. Drop the `cryptoId()`/seed logic once IDs and seed data are handled
   server-side (or keep a seed migration/script instead).
5. If multiple people will use this, add auth (see `docs/PROMPTS.md`) and
   scope every query in the API routes to the signed-in user.
