"use client";

import { useEffect, useState, useCallback } from "react";
import { rgbToHex } from "./color.js";

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
  return { notes: [], links: [], colorHistory: [] };
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
    db = {
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
      colorHistory: [],
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
    // Older saved data predates color history.
    colorHistory: db.colorHistory || [],
    addNote,
    removeNote,
    addLink,
    removeLink,
    addColorToHistory,
  };
}
