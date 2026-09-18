# Prompts for AI-assisted work on this repo

Paste these into Claude (or another coding assistant) when working in this
repo. Each assumes the assistant has read `CLAUDE.md` first — point it there
if it hasn't.

---

## Add a new tool to the Tools page

```
Read CLAUDE.md and docs/DESIGN.md first.

Add a new tool called "<NAME>" to the Tools page:
- Purpose: <what it does, e.g. "convert between hex, decimal and binary">
- Input: <what the user types/pastes>
- Output: <what it produces>

Implement it as a pure function in lib/tools.js (following the pattern of
formatJson/base64Encode — input in, string out, no DOM access), add it to
toolList, and add a small <YourTool /> component in app/tools/page.js
following the existing tool components (JsonTool, Base64Tool, etc.) — reuse
the shared inputClass/labelClass/runBtnClass constants already defined there.
Run `npm run build` when done to confirm it compiles.
```

---

## Add a new entity type (e.g. Snippets, Tags, Bookmarks folder)

```
Read CLAUDE.md and docs/DATA-MODEL.md first.

Add a new entity type "<NAME>" to the app, following the same pattern as
Notes/Links:
- Fields: <list the fields, e.g. "title, code, language, date">
- It needs: a data hook extension in lib/useHubData.js (add<Name>/remove<Name>),
  a row component in components/ItemRow.js, a page at app/<name>/page.js,
  and a nav entry in components/Sidebar.js.

Keep styling consistent with docs/DESIGN.md — reuse existing Tailwind
token classes rather than introducing new colors/radii. Run `npm run build`
when done.
```

---

## Wire up a real database (replace localStorage)

```
Read CLAUDE.md and docs/DATA-MODEL.md's "Moving from localStorage to a real
database" section first.

Replace the localStorage-backed data layer in lib/useHubData.js with a real
backend using <Vercel Postgres | Vercel KV | Supabase>. Add API routes under
app/api/ for notes and links (GET/POST/DELETE). Keep useHubData()'s returned
shape (ready, notes, links, addNote, removeNote, addLink, removeLink)
unchanged so no page or component needs to change. Don't add auth yet —
treat this as single-user for now. Run `npm run build` when done.
```

---

## Add authentication (multi-user)

```
Read CLAUDE.md and docs/DATA-MODEL.md first. This assumes a real database
and API routes already exist (see the "wire up a real database" prompt if
not).

Add authentication using next-auth (email magic link or GitHub OAuth — pick
one and tell me why). Scope every note/link to the signed-in user: add a
user_id column/field, filter all API route queries by the current session's
user, and redirect unauthenticated visitors to a sign-in page. Update the
sidebar to show the signed-in user and a sign-out action.
```

---

## General polish / bug fix prompt

```
Read CLAUDE.md first, and docs/DESIGN.md if the task touches styling.

<describe the bug or polish request>

Keep changes consistent with the existing patterns in this repo (data
through lib/useHubData.js, tool logic as pure functions in lib/tools.js,
shared Modal/ItemRow components, existing Tailwind tokens). Run `npm run
build` when done to confirm it compiles.
```
