"use server";

/**
 * Reads the poe2 league list.
 *
 * This is a server action rather than a client fetch because the trade API
 * sends no CORS headers (and answers OPTIONS with 405), so no browser can read
 * it directly — see lib/poe.js. It is a server action rather than an
 * app/api/**\/route.js because the repo has no API routes and doesn't need one
 * for a single uncached read.
 *
 * Requires the Next server: adding `output: 'export'` to next.config.mjs would
 * break this, and the League tab would fall back to FALLBACK_LEAGUES.
 */
const LEAGUES_ENDPOINT = "https://www.pathofexile.com/api/trade2/data/leagues";
const STATS_ENDPOINT = "https://www.pathofexile.com/api/trade2/data/stats";

// Cloudflare in front of pathofexile.com challenges requests from datacenter
// IPs that arrive without a User-Agent.
function poeHeaders() {
  return { Accept: "application/json", "User-Agent": "teds-tools (personal dashboard)" };
}

export async function fetchPoe2Leagues() {
  try {
    const res = await fetch(LEAGUES_ENDPOINT, { cache: "no-store", headers: poeHeaders() });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };

    const data = await res.json();
    const leagues = (data.result || [])
      .filter((l) => l && l.realm === "poe2" && l.id)
      .map((l) => l.id);

    if (leagues.length === 0) return { ok: false, reason: "No poe2 leagues returned" };
    return { ok: true, leagues };
  } catch (e) {
    return { ok: false, reason: e.message || "Request failed" };
  }
}

// The full stat table is ~850 KB, so it is fetched once per server process and
// held here rather than sent to the client. Stats only change with a patch,
// hence the long TTL.
const STATS_TTL_MS = 6 * 60 * 60 * 1000;
let statsTable = null;

async function loadStatsTable() {
  if (statsTable && Date.now() - statsTable.at < STATS_TTL_MS) return statsTable.map;

  const res = await fetch(STATS_ENDPOINT, { cache: "no-store", headers: poeHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  const map = {};
  for (const group of data.result || []) {
    for (const entry of group.entries || []) {
      if (entry && entry.id) map[entry.id] = entry.text;
    }
  }
  if (Object.keys(map).length === 0) throw new Error("No stats returned");

  statsTable = { at: Date.now(), map };
  return map;
}

/**
 * Resolves stat ids to their trade-site display text (e.g.
 * `explicit.stat_3299347043` → "# to maximum Life"). Only the requested ids are
 * returned, so the response stays small even though the table is not.
 */
export async function fetchStatTexts(ids) {
  const wanted = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === "string" && id))];
  if (wanted.length === 0) return { ok: true, texts: {} };

  try {
    const map = await loadStatsTable();
    const texts = {};
    for (const id of wanted) {
      if (map[id]) texts[id] = map[id];
    }
    return { ok: true, texts };
  } catch (e) {
    return { ok: false, reason: e.message || "Request failed", texts: {} };
  }
}
