"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { EmptyState } from "@/components/ItemRow";
import SnippetModal, { copyText } from "./Snippet";
import TradeConfigRow from "./TradeConfigRow";
import { downloadBlob } from "@/lib/zip";
import {
  PAYLOADS_FILE,
  buildPayloadMap,
  buildTradeSearchSnippet,
  extractStatGroups,
  parseTradePayloadJson,
  removeStatFilter,
  splitBundledConfigs,
  statFilterFallbackText,
  summarizeTradeConfig,
  updateStatFilter,
  updateStatGroup,
} from "@/lib/poe";

const PAYLOAD_PLACEHOLDER =
  '{"query":{"status":{"option":"online"},"stats":[{"type":"and","filters":[{"id":"explicit.stat_3299347043"}]}]},"sort":{"price":"asc"}}';

const ghostBtn =
  "flex-shrink-0 bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px] disabled:opacity-40";

const sectionLabel =
  "text-[11px] uppercase tracking-wide text-muted font-semibold mb-1.5 mt-2.5 first:mt-0";

export default function TradePanel({
  ready,
  configs,
  bundledPayloads,
  league,
  statTexts,
  onAdd,
  onUpdate,
  onRemove,
}) {
  const [snippetId, setSnippetId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [payloadText, setPayloadText] = useState("");
  const [error, setError] = useState("");
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Your configs come first, then the copies that still match the bundled file
  // — same split, and same order, as the Maker tab. Editing a bundled config
  // makes it differ from the file, so it moves up on its own.
  const { own, bundled } = useMemo(
    () => splitBundledConfigs(configs, bundledPayloads),
    [configs, bundledPayloads]
  );

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

  /**
   * The list as it reads on screen — your configs, then the bundled ones — in
   * the payload file's own shape, so the download can replace
   * `public/poe/poe2-payloads.json` and become the bundle for every browser.
   */
  function exportFile() {
    const data = buildPayloadMap([...own, ...bundled]);
    downloadBlob(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      PAYLOADS_FILE
    );
  }

  // Only your own configs get the × — the bundled ones are the app's data, and
  // deleting the copy the file put there would just bring it back on the next
  // seed. Editing one takes it over (it stops matching the file), after which
  // it is yours to delete. Same rule as the Maker's bundled groups.
  const row = (c, removable) => (
    <TradeConfigRow
      key={c.id}
      config={c}
      summary={summarizeTradeConfig(c)}
      groups={statGroups(c)}
      onSearch={search}
      onEdit={openEdit}
      onDelete={removable ? onRemove : null}
      onGroupChange={(group, patch) => changeGroup(c, group, patch)}
      onFilterChange={(filter, patch) => changeFilter(c, filter, patch)}
      onFilterRemove={(filter) => removeFilter(c, filter)}
      copied={copiedId === c.id}
    />
  );

  return (
    <>
      <div className="flex justify-between items-center gap-3 mb-2.5">
        <div className="text-[12.5px] text-muted">
          Searching <span className="text-text font-medium">{league}</span> — {configs.length} saved
          config{configs.length === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openNew} className={ghostBtn}>
            + New config
          </button>
          <button onClick={exportFile} disabled={configs.length === 0} className={ghostBtn}>
            Export .json
          </button>
        </div>
      </div>

      {!ready ? (
        <EmptyState text="Loading…" />
      ) : configs.length === 0 ? (
        <EmptyState text="No saved configs yet — add one with a trade payload." />
      ) : (
        <div className="flex flex-col">
          {own.length > 0 ? (
            <>
              <div className={sectionLabel}>Your configs</div>
              <div className="flex flex-col gap-3">{own.map((c) => row(c, true))}</div>
            </>
          ) : null}

          {bundled.length > 0 ? (
            <>
              {own.length > 0 ? <div className={sectionLabel}>Bundled</div> : null}
              <div className="flex flex-col gap-3">{bundled.map((c) => row(c, false))}</div>
            </>
          ) : null}
        </div>
      )}

      <SnippetModal
        open={snippetConfig !== null}
        title={snippetConfig ? `Snippet for ${snippetConfig.name}` : ""}
        snippet={snippet}
        league={league}
        onClose={() => setSnippetId(null)}
      />

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
