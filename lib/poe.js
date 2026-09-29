/**
 * Pure helpers for the POE Tools → Trade section.
 *
 * A saved trade config stores the raw POST body that pathofexile.com's trade
 * API expects, exactly as the reference payload files do, so a config can be
 * pasted in verbatim and nothing here re-normalises it. See docs/DATA-MODEL.md.
 */

export const DEFAULT_LEAGUE = "Standard";

/**
 * Baked list so the League tab is usable with no network call. The live list
 * is fetched on demand (app/poe/actions.js) because the trade API blocks
 * browser reads.
 */
export const FALLBACK_LEAGUES = [
  "Standard",
  "Hardcore",
];

const TRADE_ORIGIN = "https://www.pathofexile.com";

const TRADE_API_BASE = `${TRADE_ORIGIN}/api/trade2/search/poe2`;
const TRADE_SEARCH_BASE = `${TRADE_ORIGIN}/trade2/search/poe2`;

/**
 * The POST endpoint the console snippet calls. Must run from a page on
 * pathofexile.com: the API sends no CORS headers, so no other origin can
 * reach it.
 */
export function tradeApiUrl(league) {
  return `${TRADE_API_BASE}/${encodeURIComponent(league)}`;
}

/** The human-facing search page a finished search id is appended to. */
export function tradeSearchUrl(league) {
  return `${TRADE_SEARCH_BASE}/${encodeURIComponent(league)}`;
}

/**
 * How the trade site names each stat group type. A group is one entry of
 * `query.stats`; `and` means every stat must match, `count` means at least N of
 * them must, and `weight` means each stat's value is multiplied by its weight
 * and the total must fall in the group's range.
 */
const STAT_GROUP_LABELS = { and: "Stat Filters", count: "Count", weight: "Weighted Sum" };

const STAT_GROUP_HELP = {
  and: "Every listed stat must match.",
  count: "Matches when at least the given number of the listed stats match.",
  weight: "Each stat's value is multiplied by its weight; the total must fall in the range.",
};

export function statGroupLabel(type) {
  return STAT_GROUP_LABELS[type] || type || "Stat Filters";
}

export function statGroupHelp(type) {
  return STAT_GROUP_HELP[type] || "";
}

/** `count` and `weight` carry a range on the group itself; `and` does not. */
export function statGroupHasBounds(type) {
  return type === "count" || type === "weight";
}

/**
 * A payload's `query.stats` groups, in payload order, each with its type, its
 * own bounds, its `disabled` flag and its filters.
 *
 * Both levels carry a `disabled` flag: on a group it switches the whole group
 * off, on a filter it switches just that stat off. Either way the entry is kept
 * in the payload — it is saved but not applied — which is how the trade site
 * renders it. A filter is only truly in play when neither it nor its group is
 * disabled.
 *
 * min/max are kept as null rather than dropped so 0 survives: a filter with
 * `min: 0` is a real bound, not an absent one.
 */
export function extractStatGroups(payload) {
  const groups = (payload && payload.query && payload.query.stats) || [];

  return groups.map((group, groupIndex) => {
    const value = (group && group.value) || {};
    const filters = [];

    ((group && group.filters) || []).forEach((filter, filterIndex) => {
      if (!filter || !filter.id) return;
      const filterValue = filter.value || {};
      filters.push({
        id: filter.id,
        groupIndex,
        filterIndex,
        min: filterValue.min != null ? filterValue.min : null,
        max: filterValue.max != null ? filterValue.max : null,
        disabled: !!filter.disabled,
      });
    });

    return {
      groupIndex,
      type: (group && group.type) || "and",
      min: value.min != null ? value.min : null,
      max: value.max != null ? value.max : null,
      disabled: !!group.disabled,
      filters,
    };
  });
}

/** Every stat filter in a payload, flattened across its groups, in order. */
export function extractStatFilters(payload) {
  return extractStatGroups(payload).flatMap((group) => group.filters);
}

/** Bounds are edited as text, so "" means "no bound" rather than 0. */
export function parseStatBound(text) {
  const trimmed = String(text == null ? "" : text).trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function filterAt(payload, path) {
  const group = ((payload.query || {}).stats || [])[path.groupIndex];
  return group && Array.isArray(group.filters) ? group.filters[path.filterIndex] : null;
}

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

/**
 * Writes a bounds patch onto `target`, keeping the untouched side. A cleared
 * range is dropped rather than written as `{}`, matching how the reference
 * payloads store the equivalent states.
 */
function applyBounds(target, patch) {
  const current = target.value || {};
  const min = "min" in patch ? patch.min : current.min != null ? current.min : null;
  const max = "max" in patch ? patch.max : current.max != null ? current.max : null;

  delete target.value;
  if (min != null || max != null) {
    const value = {};
    if (min != null) value.min = min;
    if (max != null) value.max = max;
    target.value = value;
  }
}

/**
 * A new payload with one stat filter's bounds and/or `disabled` flag changed.
 * Everything else is copied through untouched, so a hand-written payload keeps
 * its original key order and any keys this code doesn't know about.
 */
export function updateStatFilter(payload, path, patch) {
  const next = clonePayload(payload);
  const filter = filterAt(next, path);
  if (!filter) return payload;

  if ("min" in patch || "max" in patch) applyBounds(filter, patch);

  if ("disabled" in patch) {
    if (patch.disabled) filter.disabled = true;
    else delete filter.disabled;
  }

  return next;
}

/**
 * A new payload with a group's own bounds — the range the `count` or `weight`
 * total has to fall in — and/or its `disabled` flag changed.
 */
export function updateStatGroup(payload, groupIndex, patch) {
  const next = clonePayload(payload);
  const group = ((next.query || {}).stats || [])[groupIndex];
  if (!group) return payload;

  if ("min" in patch || "max" in patch) applyBounds(group, patch);

  if ("disabled" in patch) {
    if (patch.disabled) group.disabled = true;
    else delete group.disabled;
  }

  return next;
}

/** A new payload with one stat filter removed from its group. */
export function removeStatFilter(payload, path) {
  const next = clonePayload(payload);
  const group = ((next.query || {}).stats || [])[path.groupIndex];
  if (!group || !Array.isArray(group.filters)) return payload;
  if (path.filterIndex < 0 || path.filterIndex >= group.filters.length) return payload;

  group.filters.splice(path.filterIndex, 1);
  return next;
}

/**
 * Row sub-line, e.g. "4 stat filters · 3 groups · 1 group off · any". Counts
 * only the filters actually in play — a filter inside a switched-off group
 * doesn't count, whether or not it is disabled itself.
 */
export function summarizeTradeConfig(config) {
  const payload = (config && config.payload) || {};
  const groups = extractStatGroups(payload);

  const offGroups = groups.filter((g) => g.disabled).length;
  const inOffGroups = groups
    .filter((g) => g.disabled)
    .reduce((n, g) => n + g.filters.length, 0);
  const offFilters = groups
    .filter((g) => !g.disabled)
    .reduce((n, g) => n + g.filters.filter((f) => f.disabled).length, 0);

  const total = groups.reduce((n, g) => n + g.filters.length, 0);
  const applied = total - inOffGroups - offFilters;
  const status = (payload.query && payload.query.status && payload.query.status.option) || "any";

  return [
    `${applied} stat filter${applied === 1 ? "" : "s"}`,
    groups.length > 1 ? `${groups.length} groups` : null,
    offGroups > 0 ? `${offGroups} group${offGroups === 1 ? "" : "s"} off` : null,
    offFilters > 0 ? `${offFilters} disabled` : null,
    status,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Splits the saved configs into the ones you have made or changed and the ones
 * still identical to a bundled payload (`bundledPayloads` is the file as a
 * name → payload map).
 *
 * Nothing is flagged in storage: a config counts as bundled only while it still
 * matches the file it was seeded from, so editing one — a bound, a group, the
 * JSON — moves it under your own configs without a migration, including for
 * configs seeded before this split existed. Comparing the name alone would keep
 * an edited copy looking bundled.
 */
export function splitBundledConfigs(configs, bundledPayloads) {
  const own = [];
  const bundled = [];

  for (const config of configs || []) {
    const source = bundledPayloads ? bundledPayloads[config.name] : null;
    const untouched = source && JSON.stringify(source) === JSON.stringify(config.payload);
    (untouched ? bundled : own).push(config);
  }

  return { own, bundled };
}

/**
 * Shown when the stat table can't be reached or doesn't know an id. The raw id
 * is more useful than an invented label — it's what you'd search for.
 */
export function statFilterFallbackText(id) {
  return String(id || "");
}

/**
 * The snippet the user pastes into the DevTools console on pathofexile.com.
 *
 * The tab is opened before the fetch on purpose: window.open called from
 * inside the promise callbacks is outside the user gesture and gets popup
 * blocked. Blocking it anyway only costs a log line, not the search.
 */
export function buildTradeSearchSnippet({ payload, league }) {
  const url = tradeSearchUrl(league);
  const api = tradeApiUrl(league);
  const body = JSON.stringify(payload);

  return [
    "(() => {",
    `  const url = ${JSON.stringify(url)};`,
    `  const api = ${JSON.stringify(api)};`,
    `  const payload = ${body};`,
    "  const w = window.open('', '_blank');",
    "  fetch(api, {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify(payload)",
    "  })",
    "    .then(r => r.json())",
    "    .then(d => {",
    "      const results = url + '/' + d.id;",
    "      console.log('Trade search:', d.total, 'results —', results);",
    "      if (w) w.location = results;",
    "      else console.log('Popup blocked — open manually:', results);",
    "    })",
    "    .catch(e => {",
    "      if (w) w.close();",
    "      console.error('Trade search failed:', e);",
    "    });",
    "})();",
  ].join("\n");
}

/**
 * Validates a pasted payload. Throws rather than returning an error string —
 * the caller renders one message, matching the Text Tools transforms in
 * lib/tools.js.
 */
export function parseTradePayloadJson(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) throw new Error("Paste a payload first.");

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    throw new Error(`Not valid JSON — ${e.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Payload must be a JSON object.");
  }
  if (!parsed.query || typeof parsed.query !== "object") {
    throw new Error('Payload needs a "query" object.');
  }
  return parsed;
}

/**
 * The Trade Maker's library of named stat groups, fetched by that tab. Same
 * shape as the payload file, so `parseBundledPayloads` reads it too — kept in
 * `public/` like its sibling so either JSON can be edited without touching code.
 * `GROUP_STATS_FILE` is the plain name the Maker's export downloads, so the file
 * can be dropped straight back into `public/poe/`. `PAYLOADS_FILE` is the same
 * deal for `poe2-payloads.json`, the file the Trade tab seeds from and exports
 * back out.
 */
export const GROUP_STATS_FILE = "poe2-group-stats.json";
export const PAYLOADS_FILE = "poe2-payloads.json";

export const GROUP_STATS_URL = `/poe/${GROUP_STATS_FILE}`;
export const PAYLOADS_URL = `/poe/${PAYLOADS_FILE}`;

/**
 * The bundled payload file (public/poe/poe2-payloads.json) is a plain map of
 * name → trade POST body, so each entry seeds as a config without reshaping.
 * Throws on the first bad entry rather than returning a partial list, matching
 * `parseTradePayloadJson`; the seed treats a throw as a failed load and leaves
 * its flag unset so a later load retries. The group-stats file the Trade Maker
 * reads has the same shape and is validated with this same function.
 */
export function parseBundledPayloads(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Expected a map of name → payload.");
  }

  const entries = Object.entries(data);
  if (entries.length === 0) throw new Error("The payload file is empty.");

  return entries.map(([name, payload]) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error(`"${name}" is not a payload object.`);
    }
    if (!payload.query || typeof payload.query !== "object") {
      throw new Error(`"${name}" has no "query" object.`);
    }
    return { name, payload };
  });
}

/**
 * Merges several bundled entries into one search payload. `entries` is
 * `[{ name, payload }]` in merge order: the first is the base, and every later
 * one contributes its `query.stats` groups plus any query filter section the
 * base doesn't define (see `mergeQueryFilterSections`). `status`, `sort` and
 * `name` stay the base's — they describe the search rather than a selected
 * group. Each group's own `disabled` flag is copied as-is: a merge never turns
 * a group or filter on or off.
 *
 * Returns null when nothing usable is selected, so the caller can tell an empty
 * selection from a real payload.
 */
export function mergeTradePayloads(entries) {
  const list = (entries || []).filter((e) => e && e.payload && typeof e.payload === "object");
  if (list.length === 0) return null;

  const [base, ...rest] = list;
  const merged = clonePayload(base.payload);
  const query = merged.query || (merged.query = {});
  if (!Array.isArray(query.stats)) query.stats = [];

  for (const entry of rest) {
    const other = entry.payload.query || {};

    for (const group of Array.isArray(other.stats) ? other.stats : []) {
      if (group && typeof group === "object") query.stats.push(clonePayload(group));
    }

    mergeQueryFilterSections(query, other.filters);
  }

  return merged;
}

/**
 * Adds `incoming`'s query filter sections (type_filters, weapon_filters, …) to
 * `target`. A section the target doesn't have is copied whole; otherwise only
 * the keys it is missing are added, so the base wins a conflicting one.
 */
function mergeQueryFilterSections(target, incoming) {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return;

  for (const [section, body] of Object.entries(incoming)) {
    if (!body || typeof body !== "object" || Array.isArray(body)) continue;

    const own = (target.filters || {})[section];
    if (!own || typeof own !== "object" || Array.isArray(own)) {
      target.filters = { ...(target.filters || {}), [section]: clonePayload(body) };
      continue;
    }

    const kept = own.filters && typeof own.filters === "object" ? own.filters : {};
    const extra = body.filters && typeof body.filters === "object" ? body.filters : {};
    for (const [key, value] of Object.entries(extra)) {
      if (!(key in kept)) kept[key] = clonePayload(value);
    }
    own.filters = kept;
  }
}

/**
 * A copy of `payload` narrowed to one of its `query.stats` groups, which is how
 * the Maker imports a single group out of a pasted payload. The rest of the
 * query — filters, name, status — and the sort are kept: the pasted payload is
 * the search that group came from, and only the group had to be chosen. Returns
 * the payload unchanged when it has no group at that index.
 */
export function pickStatGroup(payload, groupIndex) {
  const next = clonePayload(payload);
  const stats = ((next.query || {}).stats);
  const group = Array.isArray(stats) ? stats[groupIndex] : null;
  if (!group) return payload;

  next.query.stats = [group];
  return next;
}

/**
 * A list of named payloads as the bundled files' shape: a name → payload map,
 * in the order given. Both tabs' exports write this — the Trade tab's configs
 * and the Maker's groups — so a download can replace the file that tab reads
 * (`poe2-payloads.json`, `poe2-group-stats.json`) as it stands.
 *
 * A name already in the map is overwritten by the later entry; the Maker
 * refuses a duplicate on import for that reason, and trade configs can share a
 * name only if the user typed a duplicate by hand.
 */
export function buildPayloadMap(entries) {
  const out = {};
  for (const entry of entries || []) {
    if (entry && entry.name && entry.payload) out[entry.name] = entry.payload;
  }
  return out;
}

/**
 * Backup format for the POE Tools data, written by the System tab. The `scope`
 * and `version` markers let an import refuse a file it doesn't understand
 * instead of half-applying it. Version 2 added the Trade Maker's saved groups;
 * a version 1 file still imports, it just has none.
 */
export const POE_EXPORT_VERSION = 2;

export function buildPoeExport({ tradeConfigs, poeLeague, makerGroups, exportedAt }) {
  return {
    app: "teds-hub",
    scope: "poe",
    version: POE_EXPORT_VERSION,
    exportedAt: exportedAt || new Date().toISOString(),
    poeLeague: poeLeague || DEFAULT_LEAGUE,
    tradeConfigs: (tradeConfigs || []).map((c) => ({
      id: c.id,
      name: c.name,
      date: c.date,
      payload: c.payload,
    })),
    makerGroups: (makerGroups || []).map((g) => ({
      id: g.id,
      name: g.name,
      date: g.date,
      payload: g.payload,
    })),
  };
}

/** "3 configs · 2 Maker groups · Runes of Aldur" — what an import brings in. */
export function summarizePoeData({ tradeConfigs, poeLeague, makerGroups }) {
  const count = (tradeConfigs || []).length;
  const groups = (makerGroups || []).length;

  return [
    `${count} config${count === 1 ? "" : "s"}`,
    groups > 0 ? `${groups} Maker group${groups === 1 ? "" : "s"}` : null,
    poeLeague || DEFAULT_LEAGUE,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Validates an export before anything is written. Throws rather than returning
 * an error string — the caller shows one message, matching
 * `parseTradePayloadJson`.
 *
 * Ids and dates are passed through as given (possibly missing); the data layer
 * fills those in, since id generation belongs with the rest of the storage.
 *
 * `makerGroups` is `null` rather than `[]` when the file predates it, so the
 * caller can tell "this export has no Maker groups" from "it has none saved" and
 * leave the stored ones alone in the first case.
 */
export function parsePoeImport(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) throw new Error("Paste an export first.");

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    throw new Error(`Not valid JSON — ${e.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a POE Tools export object.");
  }
  if (parsed.scope !== "poe") {
    throw new Error('Not a POE Tools export — expected "scope": "poe".');
  }
  if (!Array.isArray(parsed.tradeConfigs)) {
    throw new Error('Export has no "tradeConfigs" list.');
  }
  if (parsed.version > POE_EXPORT_VERSION) {
    throw new Error(
      `Export is version ${parsed.version}; this build understands up to ${POE_EXPORT_VERSION}.`
    );
  }

  const tradeConfigs = parsed.tradeConfigs.map((config, i) => {
    const at = `Config ${i + 1}`;
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error(`${at} is not an object.`);
    }
    if (!config.name || typeof config.name !== "string") {
      throw new Error(`${at} has no name.`);
    }
    if (!config.payload || typeof config.payload !== "object" || Array.isArray(config.payload)) {
      throw new Error(`${at} ("${config.name}") has no payload object.`);
    }
    return {
      id: typeof config.id === "string" && config.id ? config.id : null,
      name: config.name,
      date: typeof config.date === "string" ? config.date : "",
      payload: config.payload,
    };
  });

  return {
    tradeConfigs,
    makerGroups: parseImportedMakerGroups(parsed.makerGroups),
    poeLeague:
      typeof parsed.poeLeague === "string" && parsed.poeLeague ? parsed.poeLeague : DEFAULT_LEAGUE,
  };
}

/** The Maker groups of an export, or null when the file doesn't carry any. */
function parseImportedMakerGroups(groups) {
  if (groups == null) return null;
  if (!Array.isArray(groups)) throw new Error('"makerGroups" must be a list.');

  return groups.map((group, i) => {
    const at = `Maker group ${i + 1}`;
    if (!group || typeof group !== "object" || Array.isArray(group)) {
      throw new Error(`${at} is not an object.`);
    }
    if (!group.name || typeof group.name !== "string") {
      throw new Error(`${at} has no name.`);
    }
    if (!group.payload || typeof group.payload !== "object" || Array.isArray(group.payload)) {
      throw new Error(`${at} ("${group.name}") has no payload object.`);
    }
    return {
      id: typeof group.id === "string" && group.id ? group.id : null,
      name: group.name,
      date: typeof group.date === "string" ? group.date : "",
      payload: group.payload,
    };
  });
}

