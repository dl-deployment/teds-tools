"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { rgbToHex } from "./color.js";
import {
  CYCLE_SHAPES,
  DEFAULT_LEAGUE,
  EXCHANGE_COST_URL,
  PAYLOADS_URL,
  parseBundledPayloads,
  parseExchangeCosts,
} from "./poe.js";

const MAX_COLOR_HISTORY = 16;
const DB_KEY = "teds-tools-data";
const SEED_KEY = "teds-tools-seeded";
const POE_SEED_KEY = "teds-tools-poe-seeded";
const EXCHANGE_SEED_KEY = "teds-tools-poe-exchange-seeded";

function cryptoId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function todayStr() {
  return new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function emptyDB() {
  return {
    notes: [],
    links: [],
    colorHistory: [],
    tradeConfigs: [],
    makerGroups: [],
    exchangeCosts: [],
    duoGroups: [],
    tripleGroups: [],
    poeLeague: DEFAULT_LEAGUE,
  };
}

/**
 * Add / edit / remove for one of the Exchange cycle collections. Both tabs keep
 * the same shape of row — a few item names, the rate between each pair, and the
 * amount to invest — so one machine builds both, driven by the tab's entry in
 * `CYCLE_SHAPES`.
 */
function cycleCrud(db, persist, shape) {
  const { collection, itemFields } = shape;

  return {
    add(values) {
      const group = { id: cryptoId(), base: null };
      for (const field of itemFields) {
        if (!values[field]) return null;
        group[field] = values[field];
      }
      for (const field of shape.rateFields) {
        group[field] = Number.isFinite(values[field]) ? values[field] : null;
      }

      persist({ ...db, [collection]: [...(db[collection] || []), group] });
      return group;
    },

    update(id, patch) {
      let updated = null;
      const list = (db[collection] || []).map((group) => {
        if (group.id !== id) return group;
        updated = { ...group, ...patch };
        return updated;
      });
      if (!updated) return null;

      persist({ ...db, [collection]: list });
      return updated;
    },

    remove(id) {
      persist({ ...db, [collection]: (db[collection] || []).filter((g) => g.id !== id) });
    },
  };
}

/**
 * Gives every entry a fresh id, keeping the ones the data already had unless
 * they are missing or collide inside the batch, so the list stays keyable.
 */
function withFreshIds(list) {
  const seen = new Set();
  return (list || []).map((entry) => {
    const id = entry.id && !seen.has(entry.id) ? entry.id : cryptoId();
    seen.add(id);
    return { ...entry, id };
  });
}

function loadDB() {
  if (typeof window === "undefined") return emptyDB();
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    /* ignore corrupt data */
  }
  return emptyDB();
}

function seedIfEmpty(db) {
  if (typeof window === "undefined") return db;

  if (db.notes.length === 0 && db.links.length === 0 && !window.localStorage.getItem(SEED_KEY)) {
    // Spread `db` rather than replacing it: this writes straight to storage, so
    // any collection not listed here would be dropped.
    db = {
      ...db,
      notes: [
        {
          id: cryptoId(),
          title: "Welcome to Ted's Tools",
          body: "This is your personal space for notes, links and handy dev tools. Everything you add is saved in this browser.",
          tag: "welcome",
          date: todayStr(),
        },
      ],
      links: [
        { id: cryptoId(), name: "MDN Web Docs", url: "https://developer.mozilla.org", date: todayStr() },
        { id: cryptoId(), name: "JSON Formatter", url: "https://jsonformatter.org", date: todayStr() },
      ],
    };
    window.localStorage.setItem(SEED_KEY, "1");
    window.localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  return db;
}

/**
 * A copy of `db` with the bundled configs appended, skipping any name already
 * saved so a seed never overwrites a config the user has edited. Returns null
 * when there is nothing to add, which is what leaves storage untouched.
 */
function addBundledConfigs(db, incoming) {
  const have = new Set((db.tradeConfigs || []).map((c) => c.name));
  const added = (incoming || [])
    .filter((c) => c && c.name && c.payload && !have.has(c.name))
    .map((c) => ({ id: cryptoId(), name: c.name, payload: c.payload, date: todayStr() }));

  if (added.length === 0) return null;
  return { ...db, tradeConfigs: [...(db.tradeConfigs || []), ...added] };
}

/**
 * Same one-time seed for the bundled Exchange cost list
 * (`poe2-exchange-cost.json`): append the items whose names aren't saved yet and
 * leave the rest alone, or null when there is nothing to add.
 */
function addBundledExchangeCosts(db, incoming) {
  const have = new Set((db.exchangeCosts || []).map((c) => c.name));
  const added = (incoming || [])
    .filter((c) => c && c.name && !have.has(c.name))
    .map((c) => ({ id: cryptoId(), name: c.name, group: c.group || "Other", cost: c.cost }));

  if (added.length === 0) return null;
  return { ...db, exchangeCosts: [...(db.exchangeCosts || []), ...added] };
}

/**
 * Data layer for notes, links and recent colors.
 *
 * Currently backed by localStorage so the app works with zero setup.
 * To scale this later: swap loadDB/persist for calls to API routes
 * (e.g. /api/notes, /api/links) backed by a real database — the
 * shape returned by this hook (notes, links, addNote, removeNote, ...)
 * can stay the same, so components using it won't need to change.
 */
export function useHubData() {
  const [db, setDb] = useState(emptyDB());
  const [ready, setReady] = useState(false);
  // The bundled payload file as a name → payload map; empty until it arrives,
  // and empty for good if the fetch fails.
  const [bundledPayloads, setBundledPayloads] = useState({});

  const persist = useCallback((next) => {
    setDb(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DB_KEY, JSON.stringify(next));
    }
  }, []);

  useEffect(() => {
    setDb(seedIfEmpty(loadDB()));
    setReady(true);
  }, []);

  /**
   * Reads the bundled trade searches (`poe2-payloads.json`) and seeds them into
   * storage once per browser. Drop more into the file to extend it; a browser
   * that has already seeded keeps its stored copy and skips names it already
   * has. The read happens on every load rather than only the first, because the
   * Trade tab needs the file to tell a seeded config from one the user has
   * changed — only the write is gated by the flag. The flag is set only on
   * success, so a failed fetch — offline, or a bad file — is retried on the
   * next load instead of being stranded, and the seed re-reads storage before
   * writing so it can't clobber a change made while the fetch was in flight.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    fetch(PAYLOADS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const incoming = parseBundledPayloads(data);

        // The file itself is exposed, not just the seed: the Trade tab tells a
        // config you changed from an untouched bundled copy by comparing it to
        // this, so it has to be read on every load, not only the first.
        setBundledPayloads(
          Object.fromEntries(incoming.map((config) => [config.name, config.payload]))
        );

        if (window.localStorage.getItem(POE_SEED_KEY)) return;
        const next = addBundledConfigs(loadDB(), incoming);
        if (next) persist(next);
        window.localStorage.setItem(POE_SEED_KEY, "1");
      })
      .catch(() => {
        /* leave the flag unset so a later load retries the seed */
      });

    return () => {
      cancelled = true;
    };
  }, [persist]);

  /**
   * Seeds the bundled Exchange cost list the same way, under its own flag so it
   * still reaches a browser that seeded payloads before this list existed.
   * Unlike the payload file this one is not kept in state — the Exchange Cost
   * tab lets every row be edited or deleted, so there is no bundled/own split to
   * draw. As above, the flag is set only on success so a failed fetch retries.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    fetch(EXCHANGE_COST_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const incoming = parseExchangeCosts(data);

        if (window.localStorage.getItem(EXCHANGE_SEED_KEY)) return;
        const next = addBundledExchangeCosts(loadDB(), incoming);
        if (next) persist(next);
        window.localStorage.setItem(EXCHANGE_SEED_KEY, "1");
      })
      .catch(() => {
        /* leave the flag unset so a later load retries the seed */
      });

    return () => {
      cancelled = true;
    };
  }, [persist]);

  const addNote = useCallback(
    ({ title, body, tag }) => {
      if (!title || !title.trim()) return;
      const note = { id: cryptoId(), title: title.trim(), body: (body || "").trim(), tag: (tag || "").trim(), date: todayStr() };
      persist({ ...db, notes: [...db.notes, note] });
      return note;
    },
    [db, persist]
  );

  const removeNote = useCallback(
    (id) => {
      persist({ ...db, notes: db.notes.filter((n) => n.id !== id) });
    },
    [db, persist]
  );

  const addLink = useCallback(
    ({ name, url }) => {
      if (!name || !name.trim() || !url || !url.trim()) return;
      const link = { id: cryptoId(), name: name.trim(), url: url.trim(), date: todayStr() };
      persist({ ...db, links: [...db.links, link] });
      return link;
    },
    [db, persist]
  );

  const removeLink = useCallback(
    (id) => {
      persist({ ...db, links: db.links.filter((l) => l.id !== id) });
    },
    [db, persist]
  );

  const addTradeConfig = useCallback(
    ({ name, payload }) => {
      if (!name || !name.trim() || !payload) return;
      const config = { id: cryptoId(), name: name.trim(), payload, date: todayStr() };
      persist({ ...db, tradeConfigs: [...(db.tradeConfigs || []), config] });
      return config;
    },
    [db, persist]
  );

  const updateTradeConfig = useCallback(
    (id, patch) => {
      let updated = null;
      const tradeConfigs = (db.tradeConfigs || []).map((c) => {
        if (c.id !== id) return c;
        updated = { ...c, ...patch };
        return updated;
      });
      if (!updated) return null;
      persist({ ...db, tradeConfigs });
      return updated;
    },
    [db, persist]
  );

  const removeTradeConfig = useCallback(
    (id) => {
      persist({ ...db, tradeConfigs: (db.tradeConfigs || []).filter((c) => c.id !== id) });
    },
    [db, persist]
  );

  /**
   * Swaps the whole POE Tools dataset, as the System tab's import does. Notes
   * and links are untouched. Ids the import couldn't supply, or that collide
   * with one already in the batch, get a fresh one so the list stays keyable.
   *
   * An export from before the Maker (or the Exchange) existed carries no
   * `makerGroups` / `exchangeCosts` / `duoGroups` — those arrive as null, and
   * the saved collections are left as they are rather than wiped by restoring
   * an old backup.
   */
  const replacePoeData = useCallback(
    ({ tradeConfigs, poeLeague, makerGroups, exchangeCosts, duoGroups, tripleGroups }) => {
      const next = withFreshIds(tradeConfigs).map((c) => ({
        id: c.id,
        name: c.name,
        date: c.date || todayStr(),
        payload: c.payload,
      }));

      const poeData = { tradeConfigs: next, poeLeague: poeLeague || DEFAULT_LEAGUE };
      if (makerGroups != null) {
        poeData.makerGroups = withFreshIds(makerGroups).map((g) => ({
          id: g.id,
          name: g.name,
          date: g.date || todayStr(),
          payload: g.payload,
        }));
      }
      if (exchangeCosts != null) {
        poeData.exchangeCosts = withFreshIds(exchangeCosts).map((c) => ({
          id: c.id,
          name: c.name,
          group: c.group || "Other",
          cost: c.cost,
        }));
      }
      for (const shape of Object.values(CYCLE_SHAPES)) {
        const incoming = shape === CYCLE_SHAPES.duo ? duoGroups : tripleGroups;
        if (incoming == null) continue;

        poeData[shape.collection] = withFreshIds(incoming).map((group) => {
          const stored = { id: group.id, base: group.base };
          for (const field of shape.itemFields) stored[field] = group[field];
          for (const field of shape.rateFields) stored[field] = group[field];
          return stored;
        });
      }

      persist({ ...db, ...poeData });
      return next.length;
    },
    [db, persist]
  );

  /**
   * A Trade Maker group: a name plus a payload narrowed to the one stat group
   * the Maker imported. Kept apart from `tradeConfigs` because the Maker's list
   * is source material for merging, not a search to run on its own.
   */
  const addMakerGroup = useCallback(
    ({ name, payload }) => {
      if (!name || !name.trim() || !payload) return;
      const group = { id: cryptoId(), name: name.trim(), payload, date: todayStr() };
      persist({ ...db, makerGroups: [...(db.makerGroups || []), group] });
      return group;
    },
    [db, persist]
  );

  const removeMakerGroup = useCallback(
    (id) => {
      persist({ ...db, makerGroups: (db.makerGroups || []).filter((g) => g.id !== id) });
    },
    [db, persist]
  );

  const setPoeLeague = useCallback(
    (league) => {
      if (!league) return;
      persist({ ...db, poeLeague: league });
    },
    [db, persist]
  );

  /**
   * One priced item in the Exchange cost list. Rows are edited in place, so
   * this is only for adding — a rename goes through `updateExchangeCost`.
   */
  const addExchangeCost = useCallback(
    ({ name, cost, group }) => {
      if (!name || !name.trim() || !Number.isFinite(cost)) return;
      const entry = { id: cryptoId(), name: name.trim(), group: group || "Other", cost };
      persist({ ...db, exchangeCosts: [...(db.exchangeCosts || []), entry] });
      return entry;
    },
    [db, persist]
  );

  /**
   * Edits a cost row in place — its price, or its name. A rename carries every
   * Duo group that named the item along, so a pair isn't left pointing at a name
   * the list no longer has.
   */
  const updateExchangeCost = useCallback(
    (id, patch) => {
      const current = (db.exchangeCosts || []).find((c) => c.id === id);
      if (!current) return null;

      const updated = { ...current, ...patch };
      const next = {
        ...db,
        exchangeCosts: (db.exchangeCosts || []).map((c) => (c.id === id ? updated : c)),
      };

      if (updated.name !== current.name) {
        for (const shape of Object.values(CYCLE_SHAPES)) {
          next[shape.collection] = (db[shape.collection] || []).map((group) => {
            const renamed = { ...group };
            for (const field of shape.itemFields) {
              if (renamed[field] === current.name) renamed[field] = updated.name;
            }
            return renamed;
          });
        }
      }

      persist(next);
      return updated;
    },
    [db, persist]
  );

  const removeExchangeCost = useCallback(
    (id) => {
      persist({ ...db, exchangeCosts: (db.exchangeCosts || []).filter((c) => c.id !== id) });
    },
    [db, persist]
  );

  /**
   * The Exchange cycles. A group is the items picked out of the cost list plus
   * the market rate between each pair; the items are held by name rather than by
   * id so an export reads as the chain it describes, and the card marks a name
   * the cost list no longer has instead of dropping the group. `base` is the
   * card's remaining input — how much of the first item to run through the cycle
   * — and a new group starts with it blank.
   */
  const duoCrud = useMemo(() => cycleCrud(db, persist, CYCLE_SHAPES.duo), [db, persist]);
  const tripleCrud = useMemo(() => cycleCrud(db, persist, CYCLE_SHAPES.triple), [db, persist]);

  const addColorToHistory = useCallback(
    (rgb) => {
      const hex = rgbToHex(rgb);
      const next = [{ hex, rgb }, ...(db.colorHistory || []).filter((c) => c.hex !== hex)].slice(
        0,
        MAX_COLOR_HISTORY
      );
      persist({ ...db, colorHistory: next });
    },
    [db, persist]
  );

  return {
    ready,
    notes: db.notes,
    links: db.links,
    // Older saved data predates color history, trade configs, Maker groups,
    // the Exchange collections and the league.
    colorHistory: db.colorHistory || [],
    tradeConfigs: db.tradeConfigs || [],
    makerGroups: db.makerGroups || [],
    exchangeCosts: db.exchangeCosts || [],
    duoGroups: db.duoGroups || [],
    tripleGroups: db.tripleGroups || [],
    bundledPayloads,
    poeLeague: db.poeLeague || DEFAULT_LEAGUE,
    addNote,
    removeNote,
    addLink,
    removeLink,
    addColorToHistory,
    addTradeConfig,
    updateTradeConfig,
    removeTradeConfig,
    addMakerGroup,
    removeMakerGroup,
    addExchangeCost,
    updateExchangeCost,
    removeExchangeCost,
    addDuoGroup: duoCrud.add,
    updateDuoGroup: duoCrud.update,
    removeDuoGroup: duoCrud.remove,
    addTripleGroup: tripleCrud.add,
    updateTripleGroup: tripleCrud.update,
    removeTripleGroup: tripleCrud.remove,
    setPoeLeague,
    replacePoeData,
  };
}
