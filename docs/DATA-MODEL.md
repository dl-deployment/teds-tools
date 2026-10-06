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

// A rate is a ratio of two numbers — see `normalizeRatePair`: `a` is what the
// rate buys, `b` what it pays, and the rate itself is `a / b`.
type RatePair = { a: number | null; b: number | null };

// A Duo group: two trades chained through two items — A → B → A. Each round has
// its own rate, and only the first round's amount is stored: the second spends
// what the first bought.
type DuoGroup = {
  id: string;
  aName: string;       // item names, held rather than ids (see the Exchange section)
  bName: string;
  rateAtoB: RatePair;  // round 1: how many B per how many A
  rateBtoA: RatePair;  // round 2: how many A per how many B
  totalA: number | null;  // what round 1 spends
};

// The same chain with a third item and a third round: A → B → C → A.
type TripleGroup = {
  id: string;
  aName: string;
  bName: string;
  cName: string;
  rateAtoB: RatePair;
  rateBtoC: RatePair;
  rateCtoA: RatePair;
  base: number | null;    // what round 1 spends
};

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

The two group types are the same row with a different number of items, and
nothing in the code treats them separately: `CYCLE_SHAPES` in `lib/poe.js` names
the fields each one carries — `itemFields`, `rateFields`, `amountFields` — and
the importer, the data layer and the card all read that one table. Adding a
four-item chain would mean adding a shape there, not a second copy of
everything. The two shapes' amount fields are named differently for historical
reasons (`totalA` on Duo, `base` on Triple) and mean the same thing: what the
first round spends.

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
`duoGroups`, version 4 `tripleGroups`, version 5 the `group` field on each
Exchange cost (which an older file simply leaves off, defaulting to "Other"),
version 6 the A/B split of each rate (a rate is a `{ a, b }` pair, and
`normalizeRatePair` still reads a single number from an older file), version 7 a
traded amount on each Duo group in place of the single `base` it used to invest,
and version 8 the two tabs' chained rounds: a rate per round that is nobody
else's reading, and one amount per group — what the first round spends. A file
from before those imports with the amounts blank; a leftover `totalB` from
version 7 is ignored. An older file still imports;
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

**Notes and links are seeded** from the bundled `public/hub/notes.json` and
`public/hub/links.json` on first run, under the `teds-hub-seeded` flag the old
hardcoded welcome seed used. Each file is a plain list — a note is
`{ title, body?, tag? }`, a link is `{ name, url }`:

```json
[{ "title": "Welcome to Ted's Hub", "body": "…", "tag": "welcome" }]
```

```json
[{ "name": "MDN Web Docs", "url": "https://developer.mozilla.org" }]
```

`parseBundledNotes` / `parseBundledLinks` in `lib/hub.js` validate the files and
**throw** on a malformed one (matching `parseBundledPayloads`), so the seed's
flag stays unset and the next load retries; an empty list is allowed and simply
seeds nothing, unlike the payload file where an empty file is a broken one.

Ids and dates are deliberately **not** in the file: the data layer stamps
`cryptoId()` and `todayStr()` on each seeded row, so the file can never carry two
rows with a colliding id and no date is frozen into it. Each collection is filled
only while it is still empty, so a starter list the user has already begun is
left alone; once the flag is set the seed never runs again, which is what keeps a
deleted note or link deleted. The flag is checked *before* the fetch, so a
browser that has already seeded never reads the files again — nothing needs them
after the seed (unlike `poe2-payloads.json`, which the Trade tab re-reads on
every load to tell a bundled config from your own).

`buildNotesFile` / `buildLinksFile` write the same shape back out, and each
tab's **Export .json** downloads it as the file it seeds from — so a download can
replace `public/hub/notes.json` as it stands, exactly as the POE tabs' exports
replace their files.

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

The Exchange sub-tab of the POE section has four tabs of its own: **Exchange
Cost**, **Duo Exchange**, **Triple Exchange** and **Example Rate**. The first
three share the `exchangeCosts` collection — a price list the trade tabs pick
their items out of and price their rounds at.

An `ExchangeCost` is a name, a group and a cost. The cost is a price in one
shared, unnamed unit, so only the ratios between entries carry meaning — `cost`
may be `null` for an item that has been added but not priced, which just means the
rounds that touch it can't be valued. Nothing in the tab assumes a particular currency.

The **Exchange Cost tab** splits its list into the buckets in
`EXCHANGE_GROUPS` — Currency, Fragment, Ritual, Abyss, Other — one sub-tab each.
`group` is one of those; `normalizeExchangeGroup` folds anything missing or
unrecognised (an older saved row, a hand-edited file) into "Other". The add form
writes into the group whose sub-tab is active, and each row's group select moves
it between buckets. Names stay unique across the whole list, since the trade tabs
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

**A trade group is a chain of trades** through the cost list back to where it
started — two trades for a Duo group (A → B → A), three for a Triple one
(A → B → C → A). Each round spends one item and buys the next, and **each round
carries its own rate**: the rounds are not readings of one another, which is
exactly what lets a chain make or lose anything — a chain whose rates undid each
other would land back where it started.

A rate is stored as a `RatePair`, the way every rate in this section is: `a` is
what the rate buys, `b` what it pays, and `rateFromPair` reads the quotient
`a / b`. The card types them the way the market reads — "5 : 10", five of the
row's left item for ten of the right — so `pairFromRateCell` is the one place
that order is swapped.

The group stores the shape's fields and nothing more: `itemFields` name the
items, `rateFields` one round each, and `amountFields[0]` is what the first round
spends. Every later round spends what the one before it bought, so no other
amount is stored.

`chainRun({ spent, rounds })` walks the chain. `rounds` is one entry per round in
order, each carrying the rate it goes at and the Exchange Cost list's price of
the item it buys; `duoRound` is the one-round step — what was spent becomes
`spent × rate`, priced at the list. It returns each round's own `spent` / `got` /
`gold`, every round's goods added up (`totalGold`), the round trip's `profit` —
what the last round ends holding, less what the first round spent, both being the
first item — and `goldPerProfit`: `totalGold` over that profit, the gold tied up
for each one made, which is what makes two flips of different sizes comparable.
"Gold" is whatever unit the cost list prices in; only the ratio matters.

`roundAmounts({ got, spent })` answers a round's amounts at their roundest: the
smallest whole numbers in the same ratio (9.5 for 1 is 19 for 2). It reads the
ratio rather than the amounts, so the answer is the same whatever size the round
is, and walks it as a continued fraction so it lands on the shortest fraction
that matches instead of the long denominator scaling a decimal by tens gives. It
is a suggestion the card shows beside the working — nothing stores it, and
nothing is derived from it.

Every figure is null until the inputs it needs are filled in — a round that can't
be worked out carries null and so does every round after it, and `goldPerProfit`
is null on a break-even chain, where dividing by the zero profit would only
produce an infinity — so a half-filled card leaves its cells quiet rather than
printing figures it hasn't earned.

**Both tabs draw the same card** — `ChainCard`, driven by the group's shape —
as one round per pair of lines, with a rule between the rounds and another before
the totals:

- the **rate line**: the item being bought (a picker the first time it comes up,
  its name read-only after that) at the left edge, the count got beside it, the
  count spent across the mid-line, and the item being spent — picked on this line
  only in the first round.
- the **figures line**: **cost**, what the round's goods are worth at the list
  with the bought item's listed price after it in brackets (`9,600 (160)`);
  **get**, how much the round buys; and **spent**, which is the first round's
  typed amount and every later round's carried-over amount, read-only. Each
  amount cell carries two boxes, captioned for what they are — **get** beside
  **suggest get**, **spent** beside **suggest spent**: what the round works out
  to, and `roundAmounts`' answer, the smallest whole numbers in the same ratio,
  so a round buying 9.5 for 1 reads as one buying 19 for 2. It is one suggestion
  for the round, so both cells show the same pair, each its own side.
- the **totals**: `total cost`, `profit` (green or red) and `gold / profit`, with
  the group's remove button.

Which cells are pickers follows the shape rather than the tab: an item is picked
in the round it first appears in — the bought side of rounds 1…n−1, and the spent
side of round 1 — and named read-only everywhere else, so every item a group
stores is reachable from the card and none is offered twice. Read-only cells draw
as a dashed outline instead of the filled box the inputs use, so nothing that
can't be typed into reads as a field.

The card is one CSS grid (`chainGrid`) with four columns, so each round's figures
land under the item they describe. The columns are `minmax(0,…)` so a long figure
truncates rather than pushing the card wide, and the grid carries a floor width
the wrapper scrolls against when the pane is narrower than that.

**The Example Rate tab holds no data at all.** Its rows are `EXAMPLE_RATES` in
`lib/poe.js` — a ladder of rates written into the code so the cards can be read
against figures that don't depend on anything the user has entered, the way the
Event Timeline's holidays are a static list rather than a collection.

A row is a pair of counts — `b` on the left, `a` on the right, each shown in a
read-only box — and the tab puts the rate between them divided through to a
single right-hand one: `3 ── 0.60 : 1 ── 5`. That figure is written to a fixed two
decimals (`formatRateFixed`, not `formatRate`'s significant figures), so every row
is the same shape and lines up under the one above. The list is written in order
of that rate, and every row is a fraction rather than a whole number, so a rate a
card lands on can be placed between two of them. The tab renders the list in the
order it is given; nothing is addable or editable, so reshaping the ladder is a
code change to that list and a reordering of it.

**Trade groups name their items rather than referencing their ids.** The chain is
what the group means, so an export reads as the chain it describes and a group
survives a cost list that is still being edited. The cost list calls
`updateExchangeCost`, which rewrites the name in every trade group that used it —
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
  updateExchangeCost(id, patch),   // a rename cascades to every trade group
  removeExchangeCost(id),
  addDuoGroup({ aName, bName }),        // amounts and rates start blank
  updateDuoGroup(id, patch),
  removeDuoGroup(id),
  addTripleGroup({ aName, bName, cName }),
  updateTripleGroup(id, patch),
  removeTripleGroup(id),
  setPoeLeague(league),
  replacePoeData({ tradeConfigs, poeLeague, makerGroups,   // the last four are
                   exchangeCosts, duoGroups, tripleGroups }), // optional
}
```

Both trade-group collections are built by one `cycleCrud` machine inside the
hook, driven by the tab's `CYCLE_SHAPES` entry, and the hook just hands out the
results under their own names. An add takes the shape's item names and leaves its
rates and amounts null, so a new group starts empty and the card fills it in.

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
