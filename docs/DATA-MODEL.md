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

type ColorHistoryEntry = {
  hex: string;       // "#6C8BFF" — the dedupe key
  rgb: { r: number; g: number; b: number };
};

type TradeConfig = {
  id: string;
  name: string;
  date: string;
  payload: object;   // the raw Path of Exile trade POST body, stored verbatim
};

type ExchangeCost = {
  id: string;
  name: string;        // e.g. "Divine Orb"
  group: string;       // one of EXCHANGE_GROUPS; "Other" when missing/unrecognised
  cost: number | null; // price in one shared unit; null = not priced yet
};

// A cycle group through the costs: the items it visits, the rate between each
// pair (one fewer rate than items), and the amount to invest.
type DuoGroup = {
  id: string;
  aName: string;       // item names, held rather than ids (see the Exchange section)
  bName: string;
  rateAtoB: number | null;  // how many B one A buys
  rateBtoA: number | null;  // how many A one B buys
  base: number | null;      // amount of the A item run through the cycle
};

// The same walk with one more item: A → B → C → A.
type TripleGroup = DuoGroup & { cName: string; rateBtoC: number | null; rateCtoA: number | null };

type DB = {
  notes: Note[];
  links: Link[];
  colorHistory: ColorHistoryEntry[];  // most recent first, capped at 16
  tradeConfigs: TradeConfig[];
  makerGroups: MakerGroup[];
  exchangeCosts: ExchangeCost[];
  duoGroups: DuoGroup[];
  tripleGroups: TripleGroup[];
  poeLeague: string;   // league the POE trade searches run against
};
```

The two cycle types are the same row with a different number of items, and
nothing in the code treats them separately: `CYCLE_SHAPES` in `lib/poe.js` names
the fields each one carries, and the importer, the data layer and the cards all
read that one table. Adding a four-item cycle would mean adding a shape there,
not a third copy of everything.

`payload` is kept exactly as pasted — nothing normalises it — so a config can
be copied straight into or out of the console snippet (see `lib/poe.js`). It is
not league-specific; the league comes from `poeLeague`.

A config's stat filters are **not** stored, only the ids inside `payload`. The
trade site's display text for an id (`explicit.stat_3299347043` → "# to maximum
Life") lives in an ~850 KB table on the trade API, which the browser can't read
(CORS) and which is too big to keep in the repo, so `fetchStatTexts` in
`app/poe/actions.js` resolves the ids the visible configs actually use, memoising
the whole table server-side. An unresolvable id falls back to the raw id.

`lib/poe.js` derives the rows for display. `extractStatGroups` walks
`query.stats` and returns each group with its `type`, its own bounds and its
filters, carrying `groupIndex`/`filterIndex` so any row can be written back;
`extractStatFilters` is the flattened view of the same thing. The group `type`
decides the section heading — `and` → "Stat Filters", `count` → "Count",
`weight` → "Weighted Sum" — and only `count`/`weight` carry a range on the
group itself, which is why `and` groups render no heading boxes.

The rows are editable in place, the way the trade site's filter builder works:
`updateStatFilter` sets a filter's bounds or `disabled` flag,
`updateStatGroup` sets a group's own bounds or `disabled` flag, and
`removeStatFilter` drops a filter — all returning a new payload saved through
`updateTradeConfig`. `parseStatBound` turns a min/max box's text into a number,
treating `""` as "no bound" rather than 0 — which is why bounds are stored as
`null` internally instead of being omitted. It strips thousands separators
first, the same as `parseNumberField`, since the Exchange tab's grouped boxes
show "1,000" at rest and someone editing one may well type it back that way.

## Numeric boxes

Every editable number in the POE section goes through
`components/poe/NumberField.jsx`, which commits on blur or Enter rather than on
every keystroke — typing "100" should save once, not also "1" and "10" on the
way there. A `null` value shows as empty, meaning "not set" rather than 0.

Its `group` prop switches a box to thousands-grouped display. That needs a
`type="text"` input, because a `type="number"` box cannot hold a comma: grouped
boxes show the formatted figure at rest and the plain digits while they have
focus, and are read back through `parseNumberField`. `groupNumber` does the
grouping without touching the digits, unlike `formatRate`, whose significant
figures would round a stored value's display away from what is actually stored.

**`disabled` exists at both levels and they are independent.** On a group it
switches the whole group off, on a filter just that stat; neither clears the
other, and a filter inside a switched-off group stays enabled in the payload.
Clearing a flag deletes the key rather than writing `false`, so a payload keeps
the shape it arrived in. `summarizeTradeConfig` counts a filter as in play only
when neither it nor its group is disabled, and reports the two counts
separately ("… · 1 group off · 1 disabled · any").

A `weight` group's per-stat weights are **not** editable from the hub. The key
the trade API expects for them is unverified: weighted-sum groups are rejected
anonymously ("Query is too complex"), so the format can't be probed without a
logged-in session. Weights can still be set by editing the payload JSON.

## POE Tools backup format

The System sub-tab exports and imports the POE Tools data (the trade configs, the
Trade Maker's saved groups and `poeLeague` — notes, links and colour history are
deliberately out of scope). `buildPoeExport` writes it, `parsePoeImport`
validates it, and the data layer applies it through `replacePoeData`.

```ts
type PoeExport = {
  app: "teds-hub";
  scope: "poe";        // guards against importing some other JSON
  version: number;      // POE_EXPORT_VERSION; a newer one is refused
  exportedAt: string;   // ISO
  poeLeague: string;
  tradeConfigs: TradeConfig[];   // full payloads, ids and dates included
  makerGroups: MakerGroup[];     // since version 2
  exchangeCosts: ExchangeCost[]; // since version 3
  duoGroups: DuoGroup[];         // since version 3
  tripleGroups: TripleGroup[];   // since version 4
};

type MakerGroup = { id: string; name: string; date: string; payload: object };
```

Version 2 added `makerGroups`, version 3 the Exchange `exchangeCosts` and
`duoGroups`, version 4 `tripleGroups`, and version 5 the `group` field on each
Exchange cost (which an older file simply leaves off, defaulting to "Other"). An
older file still imports;
`parsePoeImport` reports every collection added after the file was written as
**null rather than `[]`** so `replacePoeData` can tell "this backup predates it"
from "this backup has none", and leaves the stored collection alone in the first
case. `MakerGroup` payloads are the same trade POST bodies as trade configs — see
the Maker section below for what the group holds.

`parsePoeImport` **throws** (one message for the caller to show) on anything
that isn't a POE export, and validates each config has a name and a payload
object. It passes ids and dates through as-is, possibly missing: `replacePoeData`
assigns `cryptoId()` to any id that is absent or that collides with one already
in the batch, and `todayStr()` to any missing date — id generation stays in the
data layer rather than in `lib/poe.js`. Import **replaces** the POE data rather
than merging; the hook persists `{ ...db, tradeConfigs, poeLeague }` so the
other collections survive.

Everything is stored as one JSON blob under `localStorage["teds-hub-data"]`.
A one-time seed (`teds-hub-seeded` flag) inserts a welcome note and two
example links on first run, only if both lists are empty.

**Trade configs are seeded** from the bundled `public/poe/poe2-payloads.json`.
That seed runs under its own flag (`teds-hub-poe-seeded`), not the welcome
seed's guard, so it also reaches anyone who already had notes or links — the
welcome seed's guard (`notes.length === 0 && links.length === 0`) is already
false for them. Once seeded, the stored copy is authoritative: the flag means
the seed never runs again, so a deleted config stays deleted rather than
returning, and a name already saved is skipped, so a seed never overwrites a
config the user has edited. The flag is set only after a successful fetch, so a
failure (offline, or a bad file) retries on the next load instead of being
stranded. `parseBundledPayloads` in `lib/poe.js` validates the file.

The file is **fetched on every load of the POE page**, not just the first: the
hook returns it as `bundledPayloads` (a name → payload map) so the Trade tab can
tell a config that still matches the file from one the user has changed. That
split is derived, not stored — `splitBundledConfigs` in `lib/poe.js` compares
each saved config against the file by name **and payload**, so editing a seeded
config (a bound, a group, the JSON, its name) moves it under "Your configs" with
no migration and no flag, including for configs seeded long before the split
existed. The two sections are labelled only when both have rows, and your own
configs come first.

**A bundled config has no ×**, the same as a bundled Maker group: it is the
app's data, and deleting the stored copy would only bring it back the next time
that name is missing from storage. Editing one takes it over — it stops matching
the file, moves to "Your configs", and is deletable from there.

The other bundled file, `public/poe/poe2-group-stats.json`, has the same
name → payload shape but is **not** seeded: it is the Trade Maker tab's library
of partial searches, fetched (and validated with `parseBundledPayloads`) each
time that tab opens. It is read-only source material rather than stored user
data, so it never goes through `useHubData` — a failed fetch just shows an
error, and the next visit tries again.

`mergeTradePayloads(entries)` in `lib/poe.js` folds a selection of those
entries into one payload: the **first selected entry in list order** is the
base, every other entry's `query.stats` groups are appended in order, and each
other `query` filter section (`type_filters`, …) is merged with the base keeping
any key it already set. `status`, `sort` and `name` stay the base's — they
describe the search, not a selected group. Groups keep their own `disabled`
flag, so a merge never silently switches part of a search on or off. The result
is either searched (the same console snippet the Trade tab builds) or saved with
`addTradeConfig`, after which it is an ordinary config in the Trade tab.

**The list is `makerGroups` first, then the bundled file.** Your own groups come
first — and since merge order is list order, that makes an imported group the
base of a merge it takes part in, which is usually what you want of a filter you
wrote yourself. A saved group also shadows a bundled entry of the same name, and
the import refuses a name that is already taken so the list stays keyable and
the export can't silently overwrite an entry.

Maker groups are added from the Maker tab, never typed into `useHubData` by
hand: `+ New group` takes a name and a pasted trade payload, lists that
payload's `query.stats` groups, and stores the payload narrowed to the chosen
one (`pickStatGroup`) — the rest of the pasted search, its filters, name, status
and sort, comes along. `Export .json` writes the whole list back out through
`buildPayloadMap` as one name → payload map and downloads it as
`poe2-group-stats.json`, the same shape and filename as the bundled file, so the
download can replace `public/poe/poe2-group-stats.json` as it stands.

**The Trade tab exports the same way**, through the same `buildPayloadMap`: its
`Export .json` writes every saved config — your configs first, then the bundled
ones, the order they are listed in — and downloads it as `poe2-payloads.json`,
the file it seeds from. Replacing `public/poe/poe2-payloads.json` with that
download makes the list the default for a browser that has never seeded; a
browser that has already seeded keeps its stored copy either way.

## POE Tools → Exchange

The Exchange sub-tab of the POE section has three tabs of its own: **Exchange
Cost**, **Duo Exchange** and **Triple Exchange**. All three share the
`exchangeCosts` collection — a price list the cycle tabs pick their items out of
and price their holdings at.

An `ExchangeCost` is a name, a group and a cost. The cost is a price in one
shared, unnamed unit, so only the ratios between entries carry meaning — `cost`
may be `null` for an item that has been added but not priced, which just means
its legs can't be valued. Nothing in the tab assumes a particular currency.

The **Exchange Cost tab** splits its list into the buckets in
`EXCHANGE_GROUPS` — Currency, Fragment, Ritual, Abyss, Other — one sub-tab each.
`group` is one of those; `normalizeExchangeGroup` folds anything missing or
unrecognised (an older saved row, a hand-edited file) into "Other". The add form
writes into the group whose sub-tab is active, and each row's group select moves
it between buckets. Names stay unique across the whole list, since the cycle tabs
look items up by name regardless of group.

`exchangeCosts` **is seeded** from the bundled `public/poe/poe2-exchange-cost.json`,
the same one-time way trade configs are seeded from `poe2-payloads.json` but
under its own flag (`teds-hub-poe-exchange-seeded`), so it also reaches a
browser that had already seeded payloads. The file is a group → { name → price }
map and is read by `parseExchangeCosts`, which returns `null` for a blank price
and throws on anything else non-numeric. Unlike the payload file it is **not**
kept in hook state: every row in the tab is editable and deletable, including
the seeded ones, so there is no bundled/own split to draw and no reason to
re-read the file after the seed. `Export .json` writes the list back out through
`buildExchangeCostMap` as `poe2-exchange-cost.json`, the file it seeds from.

A cycle group is one walk through the cost list back to where it started: a Duo
group is A → B → A and a Triple group A → B → C → A. Each carries the items it
visits, the rate between each pair, and nothing else. `rateAtoB` is how many B
one A buys, and so on round, so a finished cycle leaves the product of all the
rates of the A you started with.

`base` is the card's remaining input beyond the rates — the amount of the first
item to invest in the cycle, shown in the box under that item's select. The rest
of the card is derived. `cycleRun({ base, legs })` walks it: `legs` is one entry
per leg in order, each naming the rate out of the holding you arrive with and the
price of the item that leg leaves you holding, so the last leg's price is the
first item's again. It returns `amounts[i]` (what the investment has become after
leg `i`), `golds[i]` (what that holding is worth at the listed prices),
`totalGold` (what the run ties up altogether), the `profit` in the item it
started from, and `goldPerProfit` — `totalGold` over that profit, i.e. the gold
the run ties up for each one it makes, which is what makes two flips of different
sizes comparable. "Gold" is whatever unit the cost list prices in; only the ratio
matters.

Every field is null until the inputs it needs are filled in — a leg that can't be
worked out yet carries null and so does the leg after it, and `goldPerProfit` is
null on a break-even run, where dividing by the zero profit would only produce an
infinity — so a half-filled card leaves its cells quiet rather than printing
figures it hasn't earned.

Both tabs share one card. It draws the chain and the two derived rows on one CSS
grid, so the figures sit in the same columns as the item boxes and rate boxes
above them — each of those cells names its column outright, and the column widths
are built from the number of legs (`cycleGrid`), since that is what decides how
long the chain is and how narrow the grid can get before the card scrolls. The
two rows are labelled **Amount** (what you hold at each step) and **Gold** (what
each hold is worth), and both end in a ruled-off **Result** column holding the
run's two totals: the profit beside Amount, and beside Gold the gold outlay with
`goldPerProfit` following it in brackets — `20,500 (4,100)`. A break-even run
prints the outlay on its own, having no ratio to show. The chain row leaves the
label column empty and heads the Result column.

**Cycle groups name their items rather than referencing their ids.** The chain is
what the group means, so an export reads as the chain it describes and a group
survives a cost list that is still being edited. The cost list calls
`updateExchangeCost`, which rewrites the name in every cycle group that used it —
both tabs, every item field of the shape; a group whose item is *deleted* keeps
the stale name, and the card shows it as "… (not in cost list)" instead of
silently switching to another item.

Whatever a seed adds must be spread into the loaded `db` (`{ ...db, notes: … }`)
rather than replacing it: `seedIfEmpty` writes straight to storage, so an
object literal without a key would drop that whole collection.

Keep the write path and the read path in the same place — an earlier
`migrateLegacyKeys()` helper here read and then removed a legacy key whose
name was identical to `DB_KEY`, which deleted the whole database and the seed
flag on every load and re-seeded over the top of it. Anything that touches
these keys must be checked against the constants above.

## The hook contract

`useHubData()` returns:

```js
{
  ready,        // bool — false until localStorage has been read (avoids SSR mismatch)
  notes, links, colorHistory,  // arrays, as above
  addNote({ title, body, tag }),
  removeNote(id),
  addLink({ name, url }),
  removeLink(id),
  addColorToHistory({ r, g, b }),   // dedupes by hex, newest first, keeps 16
  tradeConfigs, makerGroups, exchangeCosts, duoGroups, tripleGroups,
  poeLeague, bundledPayloads,
  addTradeConfig({ name, payload }),
  updateTradeConfig(id, patch),
  removeTradeConfig(id),
  addMakerGroup({ name, payload }),
  removeMakerGroup(id),
  addExchangeCost({ name, cost, group }),
  updateExchangeCost(id, patch),   // a rename cascades to every cycle group
  removeExchangeCost(id),
  addDuoGroup({ aName, bName, rateAtoB, rateBtoA }),
  updateDuoGroup(id, patch),
  removeDuoGroup(id),
  addTripleGroup({ aName, bName, cName, rateAtoB, rateBtoC, rateCtoA }),
  updateTripleGroup(id, patch),
  removeTripleGroup(id),
  setPoeLeague(league),
  replacePoeData({ tradeConfigs, poeLeague, makerGroups,   // the last four are
                   exchangeCosts, duoGroups, tripleGroups }), // optional
}
```

Both cycle collections are built by one `cycleCrud` machine inside the hook,
driven by the tab's `CYCLE_SHAPES` entry, and the hook just hands out the results
under their own names.

The POE collections are all read with `|| []` / `|| DEFAULT_LEAGUE` so data
saved before they existed still loads. `replacePoeData` only rewrites
`makerGroups`, `exchangeCosts`, `duoGroups` and `tripleGroups` when the import
carries them — passed as null by an older export, they are left as they are.

**Call the hook once per page.** Each instance holds its own `db`, and every
write persists a whole-object read-modify-write of `teds-hub-data` — two
instances on one page would clobber each other's collections. `app/poe/page.js`
therefore calls it once and passes the collections and callbacks into
`components/poe/*` as props.

`colorHistory` is read with `db.colorHistory || []` so data saved before it
existed still loads.

Pages only ever call this hook — never `localStorage` directly. This is the
seam to change when moving to a real backend.

Not everything belongs in here: the Event Timeline's holiday list
(`lib/events.js`) is static reference data the user never edits, so it is a
plain imported array rather than a hook-backed collection. Anything the user
creates, edits or deletes goes through the hook.

## Adding a new entity type (e.g. "Snippets")

1. Extend `DB` in `lib/useHubData.js`: add `snippets: []` to `emptyDB()`.
2. Add `addSnippet` / `removeSnippet` following the existing `addNote`/
   `removeNote` pattern (validate required fields, generate `id` + `date`,
   `persist({ ...db, snippets: [...] })`).
3. Return the new fields/functions from the hook.
4. Add `app/snippets/page.js` (copy `app/notes/page.js` as a starting point),
   a `SnippetRow` in `components/ItemRow.js`, and a nav entry in
   `components/Sidebar.js`.
5. Nothing else — there is no Home/dashboard view to surface it on, so the
   nav entry is the only place a new entity type appears.

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
