"use client";

import { useEffect, useState, useCallback } from "react";
import { rgbToHex } from "./color.js";
import { DEFAULT_LEAGUE } from "./poe.js";

const MAX_COLOR_HISTORY = 16;
const DB_KEY = "teds-hub-data";
const SEED_KEY = "teds-hub-seeded";

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
  return { notes: [], links: [], colorHistory: [], tradeConfigs: [], poeLeague: DEFAULT_LEAGUE };
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
          title: "Welcome to Ted's Hub",
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

  useEffect(() => {
    setDb(seedIfEmpty(loadDB()));
    setReady(true);
  }, []);

  const persist = useCallback((next) => {
    setDb(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DB_KEY, JSON.stringify(next));
    }
  }, []);

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
   */
  const replacePoeData = useCallback(
    ({ tradeConfigs, poeLeague }) => {
      const seen = new Set();
      const next = (tradeConfigs || []).map((c) => {
        const id = c.id && !seen.has(c.id) ? c.id : cryptoId();
        seen.add(id);
        return { id, name: c.name, date: c.date || todayStr(), payload: c.payload };
      });
      persist({ ...db, tradeConfigs: next, poeLeague: poeLeague || DEFAULT_LEAGUE });
      return next.length;
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
    // Older saved data predates color history, trade configs and the league.
    colorHistory: db.colorHistory || [],
    tradeConfigs: db.tradeConfigs || [],
    poeLeague: db.poeLeague || DEFAULT_LEAGUE,
    addNote,
    removeNote,
    addLink,
    removeLink,
    addColorToHistory,
    addTradeConfig,
    updateTradeConfig,
    removeTradeConfig,
    setPoeLeague,
    replacePoeData,
  };
}
