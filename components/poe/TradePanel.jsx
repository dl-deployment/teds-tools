"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { EmptyState } from "@/components/ItemRow";
import TradeConfigRow from "./TradeConfigRow";
import {
  buildTradeSearchSnippet,
  extractStatGroups,
  parseTradePayloadJson,
  removeStatFilter,
  statFilterFallbackText,
  summarizeTradeConfig,
  tradeSearchUrl,
  updateStatFilter,
  updateStatGroup,
} from "@/lib/poe";

const PAYLOAD_PLACEHOLDER =
  '{"query":{"status":{"option":"online"},"stats":[{"type":"and","filters":[{"id":"explicit.stat_3299347043"}]}]},"sort":{"price":"asc"}}';

/** Clipboard API needs a secure context; bare http falls back to execCommand. */
async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      /* fall through */
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-1000px";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (e) {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export default function TradePanel({ ready, configs, league, statTexts, onAdd, onUpdate, onRemove }) {
  const [snippetId, setSnippetId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [payloadText, setPayloadText] = useState("");
  const [error, setError] = useState("");
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Derived rather than stored, so editing a filter or switching league updates
  // the visible snippet instead of leaving a stale one on screen.
  const snippetConfig = configs.find((c) => c.id === snippetId) || null;
  const snippet = snippetConfig
    ? buildTradeSearchSnippet({ payload: snippetConfig.payload, league })
    : "";

  async function search(config) {
    setSnippetId(config.id);
    if (await copyText(buildTradeSearchSnippet({ payload: config.payload, league }))) {
      clearTimeout(timer.current);
      setCopiedId(config.id);
      timer.current = setTimeout(() => setCopiedId(null), 1500);
    }
  }

  function openNew() {
    setEditingId(null);
    setName("");
    setPayloadText("");
    setError("");
    setOpen(true);
  }

  function openEdit(config) {
    setEditingId(config.id);
    setName(config.name);
    setPayloadText(JSON.stringify(config.payload, null, 2));
    setError("");
    setOpen(true);
  }

  function save() {
    let payload;
    try {
      payload = parseTradePayloadJson(payloadText);
    } catch (e) {
      setError(e.message);
      return;
    }
    if (!name.trim()) {
      setError("Give the config a name.");
      return;
    }
    if (editingId) onUpdate(editingId, { name: name.trim(), payload });
    else onAdd({ name, payload });
    close();
  }

  function close() {
    setOpen(false);
    setEditingId(null);
    setError("");
  }

  function changeFilter(config, filter, patch) {
    onUpdate(config.id, { payload: updateStatFilter(config.payload, filter, patch) });
  }

  function changeGroup(config, group, patch) {
    onUpdate(config.id, { payload: updateStatGroup(config.payload, group.groupIndex, patch) });
  }

  function removeFilter(config, filter) {
    onUpdate(config.id, { payload: removeStatFilter(config.payload, filter) });
  }

  // Stat ids are resolved by the server action and fall back to the raw id
  // until they arrive (or if the trade API is unreachable).
  function statGroups(config) {
    return extractStatGroups(config.payload).map((group) => ({
      ...group,
      filters: group.filters.map((f) => ({
        ...f,
        text: statTexts[f.id] || statFilterFallbackText(f.id),
      })),
    }));
  }

  return (
    <>
      <div className="flex justify-between items-center gap-3 mb-2.5">
        <div className="text-[12.5px] text-muted">
          Searching <span className="text-text font-medium">{league}</span> — {configs.length} saved
          config{configs.length === 1 ? "" : "s"}
        </div>
        <button
          onClick={openNew}
          className="flex-shrink-0 bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px]"
        >
          + New config
        </button>
      </div>

      {!ready ? (
        <EmptyState text="Loading…" />
      ) : configs.length === 0 ? (
        <EmptyState text="No saved configs yet — add one with a trade payload." />
      ) : (
        <div className="flex flex-col gap-3">
          {configs.map((c) => (
            <TradeConfigRow
              key={c.id}
              config={c}
              summary={summarizeTradeConfig(c)}
              groups={statGroups(c)}
              onSearch={search}
              onEdit={openEdit}
              onDelete={onRemove}
              onGroupChange={(group, patch) => changeGroup(c, group, patch)}
              onFilterChange={(filter, patch) => changeFilter(c, filter, patch)}
              onFilterRemove={(filter) => removeFilter(c, filter)}
              copied={copiedId === c.id}
            />
          ))}
        </div>
      )}

      {snippetConfig ? (
        <div className="mt-4">
          <div className="flex justify-between items-center gap-3 mb-2">
            <div className="text-[13px] font-semibold">
              Snippet for {snippetConfig.name}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyText(snippet)}
                className="bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px]"
              >
                Copy
              </button>
              <a
                href={tradeSearchUrl(league)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-transparent border border-border text-accent px-2.5 py-1.5 rounded-lg text-[12.5px] no-underline"
              >
                Open {league} trade ↗
              </a>
            </div>
          </div>
          <pre className="bg-bg border border-border rounded-lg p-3 text-[12px] font-mono text-muted whitespace-pre-wrap break-all max-h-[320px] overflow-y-auto">
            {snippet}
          </pre>
          <div className="text-[11.5px] text-muted mt-2">
            Paste it into the DevTools console (F12) on that page and press Enter — the search runs
            same-origin and opens the results in a new tab.
          </div>
        </div>
      ) : null}

      <Modal open={open} title={editingId ? "Edit trade config" : "New trade config"} onClose={close}>
        <label className="block text-[12.5px] text-muted mt-2.5 mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Resistance"
          className="w-full bg-bg border border-border text-text px-2.5 py-2 rounded-lg text-[13.5px]"
        />
        <label className="block text-[12.5px] text-muted mt-2.5 mb-1.5">Payload (JSON)</label>
        <textarea
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          placeholder={PAYLOAD_PLACEHOLDER}
          spellCheck={false}
          className="w-full bg-bg border border-border text-text px-2.5 py-2 rounded-lg text-[12px] font-mono min-h-[140px] resize-y"
        />
        {error ? <div className="text-[12.5px] text-red-400 mt-2">{error}</div> : null}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={close}
            className="bg-transparent border border-border text-text px-3.5 py-2 rounded-lg text-[13.5px]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="bg-accent text-white px-3.5 py-2 rounded-lg text-[13.5px] font-medium"
          >
            {editingId ? "Save changes" : "Save config"}
          </button>
        </div>
      </Modal>
    </>
  );
}
