"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { EmptyState } from "@/components/ItemRow";
import SnippetModal, { copyText } from "./Snippet";
import { downloadBlob } from "@/lib/zip";
import {
  GROUP_STATS_FILE,
  GROUP_STATS_URL,
  buildPayloadMap,
  buildTradeSearchSnippet,
  extractStatFilters,
  extractStatGroups,
  mergeTradePayloads,
  parseBundledPayloads,
  parseTradePayloadJson,
  pickStatGroup,
  statFilterFallbackText,
  statGroupLabel,
  summarizeTradeConfig,
} from "@/lib/poe";
import { fetchStatTexts } from "@/app/poe/actions";

const ghostBtn =
  "flex-shrink-0 bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px] disabled:opacity-40";

const sectionLabel =
  "text-[11px] uppercase tracking-wide text-muted font-semibold mb-1.5 mt-2.5 first:mt-0";

/** "20 – any", or null when the filter carries no bound at all. */
function boundText(min, max) {
  if (min == null && max == null) return null;
  return `${min == null ? "any" : min} – ${max == null ? "any" : max}`;
}

/**
 * Read-only view of one entry's stat groups, laid out like the Trade tab's
 * group editor minus the inputs — selecting and merging happens at the entry
 * level here, so nothing on this page is editable.
 */
function GroupPreview({ groups, statTexts }) {
  if (groups.length === 0) {
    return <div className="mt-2.5 text-[12.5px] text-muted">No stat filters in this group.</div>;
  }

  return (
    <div className="mt-2.5 flex flex-col gap-2">
      {groups.map((group) => (
        <div key={group.groupIndex} className="bg-bg border border-border rounded-lg px-2.5 py-2">
          <div className="flex items-center gap-2 pb-1.5 mb-1.5 border-b border-border">
            <span
              className={`text-[11px] uppercase tracking-wide font-semibold ${
                group.disabled ? "text-muted/50 line-through" : "text-muted"
              }`}
            >
              {statGroupLabel(group.type)}
            </span>
            {group.disabled ? <span className="text-[11px] text-muted/60">off</span> : null}
            <span className="flex-1 min-w-0" />
            {boundText(group.min, group.max) ? (
              <span className="flex-shrink-0 text-[11.5px] font-mono text-muted">
                {boundText(group.min, group.max)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            {group.filters.map((filter) => {
              const text = statTexts[filter.id] || statFilterFallbackText(filter.id);
              return (
                <div
                  key={`${filter.groupIndex}.${filter.filterIndex}`}
                  className="flex items-center gap-2"
                >
                  <span
                    className={`flex-1 min-w-0 text-[12px] uppercase tracking-wide truncate ${
                      filter.disabled ? "text-muted/50 line-through" : "text-text"
                    }`}
                    title={text}
                  >
                    {text}
                  </span>
                  {boundText(filter.min, filter.max) ? (
                    <span className="flex-shrink-0 text-[11.5px] font-mono text-muted">
                      {boundText(filter.min, filter.max)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** One selectable entry: tick to merge it, expand to read its stat groups. */
function GroupRow({ entry, checked, open, statTexts, onToggle, onToggleOpen, onRemove }) {
  return (
    <div className="bg-panel2 border border-border rounded-xl px-3 py-2">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="checkbox"
          checked={checked}
          title={checked ? "Remove from the merge" : "Add to the merge"}
          onChange={() => onToggle(entry.name)}
          className="flex-shrink-0 accent-accent"
        />
        <button
          type="button"
          onClick={() => onToggleOpen(entry.name)}
          aria-expanded={open}
          title={open ? "Hide stat groups" : "Show stat groups"}
          className="flex-1 min-w-[140px] text-left flex items-center gap-2"
        >
          <span className="text-muted text-[10px] leading-none w-2.5 flex-shrink-0">
            {open ? "▼" : "▶"}
          </span>
          <span className="min-w-0 flex-1 flex items-baseline gap-2">
            <span className="text-[12.5px] font-semibold truncate">{entry.name}</span>
            <span className="text-[11px] text-muted truncate">
              {summarizeTradeConfig({ payload: entry.payload })}
            </span>
          </span>
        </button>
        {onRemove ? (
          <div
            title="Delete this saved group"
            onClick={() => onRemove(entry)}
            className="text-muted hover:text-red-400 hover:bg-red-400/10 cursor-pointer text-base leading-none px-1.5 py-0.5 rounded-md flex-shrink-0"
          >
            ×
          </div>
        ) : null}
      </div>

      {open ? <GroupPreview groups={extractStatGroups(entry.payload)} statTexts={statTexts} /> : null}
    </div>
  );
}

/**
 * Import one stat group out of a pasted payload. The payload may hold several
 * `query.stats` groups — the trade site's own filters do — so the group to keep
 * is picked from a list; everything else about the pasted search (its filters,
 * name, status and sort) comes along with it.
 */
function NewGroupModal({ open, existingNames, statTexts, onSave, onClose }) {
  const [name, setName] = useState("");
  const [payloadText, setPayloadText] = useState("");
  const [chosen, setChosen] = useState(0);
  const [error, setError] = useState("");
  const [texts, setTexts] = useState({});
  const requested = useRef(new Set());

  useEffect(() => {
    if (!open) return;
    setName("");
    setPayloadText("");
    setChosen(0);
    setError("");
    setTexts({});
    requested.current = new Set();
  }, [open]);

  // Parsed as you type so the group list, and the reason Save is blocked, are
  // on screen — the button can't be pressed to reveal the error.
  const { payload, parseError } = useMemo(() => {
    if (!payloadText.trim()) return { payload: null, parseError: "" };
    try {
      return { payload: parseTradePayloadJson(payloadText), parseError: "" };
    } catch (e) {
      return { payload: null, parseError: e.message };
    }
  }, [payloadText]);

  const options = payload ? extractStatGroups(payload) : [];

  // A different payload means the previously picked index may not exist.
  useEffect(() => setChosen(0), [payload]);

  // Names for a fresh paste come from the trade API via the server action;
  // until they arrive, each row shows the raw id. Debounced so typing a payload
  // doesn't fire a request per keystroke.
  useEffect(() => {
    if (!payload) return;

    const wanted = [...new Set(extractStatFilters(payload).map((f) => f.id))].filter(
      (id) => !requested.current.has(id)
    );
    if (wanted.length === 0) return;

    const timer = setTimeout(() => {
      for (const id of wanted) requested.current.add(id);
      fetchStatTexts(wanted).then((res) => {
        if (res.ok) setTexts((prev) => ({ ...prev, ...res.texts }));
        // Release them so a later paste retries rather than stranding raw ids.
        else for (const id of wanted) requested.current.delete(id);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [payload]);

  const labelTexts = { ...statTexts, ...texts };

  function save() {
    if (!payload) {
      setError(parseError || "Paste a payload that contains the group.");
      return;
    }
    if (!name.trim()) {
      setError("Give the group a name.");
      return;
    }
    if (existingNames.has(name.trim())) {
      setError("A group with that name is already in the list.");
      return;
    }
    if (options.length === 0) {
      setError("This payload has no stat group to import.");
      return;
    }
    onSave({ name: name.trim(), payload: pickStatGroup(payload, chosen) });
  }

  return (
    <Modal open={open} title="Import a stat group" onClose={onClose}>
      <label className="block text-[12.5px] text-muted mt-2.5 mb-1.5">Name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError("");
        }}
        placeholder="e.g. T1 Resistances"
        className="w-full bg-bg border border-border text-text px-2.5 py-2 rounded-lg text-[13.5px]"
      />

      <label className="block text-[12.5px] text-muted mt-2.5 mb-1.5">Payload (JSON)</label>
      <textarea
        value={payloadText}
        onChange={(e) => {
          setPayloadText(e.target.value);
          setError("");
        }}
        placeholder='{"query":{"status":{"option":"online"},"stats":[{"type":"count","filters":[{"id":"explicit.stat_3299347043"}]}]}}'
        spellCheck={false}
        className="w-full bg-bg border border-border text-text px-2.5 py-2 rounded-lg text-[12px] font-mono min-h-[120px] resize-y"
      />

      {parseError ? (
        <div className="text-[11.5px] text-red-400 mt-2">{parseError}</div>
      ) : options.length === 0 ? (
        <div className="text-[11.5px] text-muted mt-2">
          {payload ? "This payload has no stat group to import." : "Paste a payload to list its stat groups."}
        </div>
      ) : (
        <>
          <div className="text-[12.5px] text-muted mt-2.5 mb-1.5">
            Import which stat group? ({options.length} in this payload)
          </div>
          <div className="flex flex-col gap-1.5">
            {options.map((group, i) => (
              <label
                key={group.groupIndex}
                className={`flex gap-2 items-start bg-bg border rounded-lg px-2.5 py-2 cursor-pointer ${
                  chosen === i ? "border-accent" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="maker-group"
                  checked={chosen === i}
                  onChange={() => setChosen(i)}
                  className="mt-1 flex-shrink-0 accent-accent"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wide font-semibold text-muted">
                      {statGroupLabel(group.type)}
                    </span>
                    {boundText(group.min, group.max) ? (
                      <span className="text-[11.5px] font-mono text-muted">
                        {boundText(group.min, group.max)}
                      </span>
                    ) : null}
                    <span className="flex-1 min-w-0" />
                    <span className="text-[11px] text-muted">
                      {group.filters.length} filter{group.filters.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span
                    className="block text-[12px] text-muted mt-1 line-clamp-2"
                    title={group.filters
                      .map((f) => labelTexts[f.id] || statFilterFallbackText(f.id))
                      .join(" · ")}
                  >
                    {group.filters
                      .map((f) => labelTexts[f.id] || statFilterFallbackText(f.id))
                      .join(" · ")}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </>
      )}

      {error ? <div className="text-[12.5px] text-red-400 mt-2">{error}</div> : null}

      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onClose}
          className="bg-transparent border border-border text-text px-3.5 py-2 rounded-lg text-[13.5px]"
        >
          Cancel
        </button>
        <button
          onClick={save}
          className="bg-accent text-white px-3.5 py-2 rounded-lg text-[13.5px] font-medium"
        >
          Import group
        </button>
      </div>
    </Modal>
  );
}

/**
 * Merges stat groups into a new trade search. The bundled file
 * (public/poe/poe2-group-stats.json) is read-only source material rather than
 * saved user data, so it is fetched here instead of going through useHubData; a
 * failed fetch only costs the bundled entries, and retries on the next visit.
 * The groups imported through the modal are saved, and exported back out as the
 * same file shape so the list can be edited in bulk and committed.
 */
export default function MakerPanel({
  ready,
  savedGroups,
  league,
  onAddGroup,
  onRemoveGroup,
  onAddConfig,
}) {
  const [entries, setEntries] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [statTexts, setStatTexts] = useState({});
  const [selected, setSelected] = useState(() => new Set());
  const [openNames, setOpenNames] = useState(() => new Set());
  const [newOpen, setNewOpen] = useState(false);
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    let cancelled = false;
    fetch(GROUP_STATS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setEntries(parseBundledPayloads(data));
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message || "Could not read the group file.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saved = savedGroups || [];
  const savedNames = useMemo(() => new Set(saved.map((g) => g.name)), [saved]);

  // Your own groups come first — that is also the merge order, so the group you
  // imported is the one whose status, sort and filters survive a merge. A saved
  // group shadows a bundled entry of the same name.
  const bundled = useMemo(
    () => (entries || []).filter((e) => !savedNames.has(e.name)),
    [entries, savedNames]
  );
  const groups = useMemo(() => [...saved, ...bundled], [saved, bundled]);
  const loading = !ready || (entries === null && !loadError);

  // Names come from the trade API, so they're resolved by the server action.
  // A failed request leaves the rows on their raw ids rather than blank.
  const requested = useRef(new Set());
  useEffect(() => {
    const ids = [...new Set(groups.flatMap((e) => extractStatFilters(e.payload).map((f) => f.id)))];
    const wanted = ids.filter((id) => !requested.current.has(id));
    if (wanted.length === 0) return;

    for (const id of wanted) requested.current.add(id);
    fetchStatTexts(wanted).then((res) => {
      if (res.ok) setStatTexts((prev) => ({ ...prev, ...res.texts }));
      else for (const id of wanted) requested.current.delete(id);
    });
  }, [groups]);

  const chosen = useMemo(() => groups.filter((e) => selected.has(e.name)), [groups, selected]);
  const merged = useMemo(() => mergeTradePayloads(chosen), [chosen]);
  const chosenNames = chosen.map((e) => e.name).join(" + ");

  function toggle(name) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleOpen(name) {
    setOpenNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function removeGroup(entry) {
    onRemoveGroup(entry.id);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(entry.name);
      return next;
    });
  }

  function exportFile() {
    const data = buildPayloadMap(groups);
    downloadBlob(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      GROUP_STATS_FILE
    );
  }

  async function search() {
    if (!merged) return;
    setSnippetOpen(true);
    if (await copyText(buildTradeSearchSnippet({ payload: merged, league }))) {
      clearTimeout(timer.current);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 1500);
    }
  }

  function openSave() {
    setSaveName(chosenNames);
    setSaveOpen(true);
  }

  function save() {
    if (!merged || !saveName.trim()) return;
    onAddConfig({ name: saveName, payload: merged });
    setSaveOpen(false);
  }

  const row = (entry, removable) => (
    <GroupRow
      key={entry.id || entry.name}
      entry={entry}
      checked={selected.has(entry.name)}
      open={openNames.has(entry.name)}
      statTexts={statTexts}
      onToggle={toggle}
      onToggleOpen={toggleOpen}
      onRemove={removable ? removeGroup : null}
    />
  );

  return (
    <>
      <div className="flex justify-between items-center gap-3 flex-wrap mb-2.5">
        <div className="text-[12.5px] text-muted">
          {loading ? (
            "Loading groups…"
          ) : (
            <>
              {groups.length} group{groups.length === 1 ? "" : "s"} — tick the ones to merge, searching{" "}
              <span className="text-text font-medium">{league}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setNewOpen(true)} className={ghostBtn}>
            + New group
          </button>
          <button onClick={exportFile} disabled={groups.length === 0} className={ghostBtn}>
            Export .json
          </button>
          {selected.size > 0 ? (
            <button onClick={() => setSelected(new Set())} className={ghostBtn}>
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <div className="text-[11.5px] text-red-400 mb-2.5">
          Could not load {GROUP_STATS_URL} — {loadError}
        </div>
      ) : null}

      <div className="flex flex-col">
        {saved.length > 0 ? (
          <>
            <div className={sectionLabel}>Your groups</div>
            <div className="flex flex-col gap-2">{saved.map((g) => row(g, true))}</div>
          </>
        ) : null}

        {loading ? (
          <div className="text-[12.5px] text-muted mt-2.5">Loading…</div>
        ) : groups.length === 0 ? (
          <EmptyState text={`No groups in ${GROUP_STATS_FILE} — import one with + New group.`} />
        ) : (
          <>
            {saved.length > 0 ? <div className={sectionLabel}>Bundled</div> : null}
            <div className="flex flex-col gap-2">{bundled.map((e) => row(e, false))}</div>
          </>
        )}
      </div>

      {merged ? (
        <div className="mt-3 bg-panel2 border border-accent/40 rounded-xl px-3 py-3">
          <div className="flex items-center gap-3 flex-wrap mb-2.5">
            <div
              className="flex-1 min-w-[160px] text-[12.5px] text-muted truncate"
              title={chosenNames}
            >
              Merged <span className="text-text">{chosenNames}</span> —{" "}
              {summarizeTradeConfig({ payload: merged })}
            </div>
            <button
              onClick={search}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] ${
                copied
                  ? "bg-transparent border border-accent2/40 text-accent2"
                  : "bg-accent text-white font-medium"
              }`}
            >
              {copied ? "Copied" : "Search"}
            </button>
            <button onClick={openSave} className={ghostBtn}>
              Save to Trade
            </button>
          </div>
          <pre className="bg-bg border border-border rounded-lg p-3 text-[12px] font-mono text-muted whitespace-pre-wrap break-all max-h-[280px] overflow-y-auto">
            {JSON.stringify(merged, null, 2)}
          </pre>
        </div>
      ) : null}

      <NewGroupModal
        open={newOpen}
        existingNames={new Set(groups.map((e) => e.name))}
        statTexts={statTexts}
        onSave={(group) => {
          onAddGroup(group);
          setNewOpen(false);
        }}
        onClose={() => setNewOpen(false)}
      />

      <SnippetModal
        open={snippetOpen}
        title={`Snippet — ${chosenNames}`}
        snippet={merged ? buildTradeSearchSnippet({ payload: merged, league }) : ""}
        league={league}
        onClose={() => setSnippetOpen(false)}
      />

      <Modal open={saveOpen} title="Save merged search" onClose={() => setSaveOpen(false)}>
        <label className="block text-[12.5px] text-muted mt-2.5 mb-1.5">Name</label>
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="e.g. Boots + Res"
          className="w-full bg-bg border border-border text-text px-2.5 py-2 rounded-lg text-[13.5px]"
        />
        <div className="text-[11.5px] text-muted mt-2.5">
          Adds it to the Trade tab, where its stat filters can be edited like any other config.
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setSaveOpen(false)}
            className="bg-transparent border border-border text-text px-3.5 py-2 rounded-lg text-[13.5px]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="bg-accent text-white px-3.5 py-2 rounded-lg text-[13.5px] font-medium"
          >
            Save config
          </button>
        </div>
      </Modal>
    </>
  );
}
