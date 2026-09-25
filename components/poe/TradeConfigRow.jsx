"use client";

import { useEffect, useState } from "react";
import { parseStatBound, statGroupHasBounds, statGroupHelp, statGroupLabel } from "@/lib/poe";

const fieldClass =
  "w-[68px] flex-shrink-0 bg-bg border border-border text-text px-1.5 py-1 rounded-lg text-[12.5px] text-center font-mono placeholder:font-sans placeholder:text-muted/60";

/**
 * One min/max box. The bound is committed on blur or Enter rather than on every
 * keystroke, so typing "100" writes once instead of also saving "1" and "10"
 * on the way there.
 */
function BoundInput({ label, value, dimmed, onCommit }) {
  const [text, setText] = useState(value == null ? "" : String(value));

  // Re-sync when the payload changes underneath us (a JSON edit, or the value
  // landing from storage after mount).
  useEffect(() => {
    setText(value == null ? "" : String(value));
  }, [value]);

  return (
    <input
      type="number"
      step="any"
      inputMode="decimal"
      value={text}
      placeholder={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={`${fieldClass} ${dimmed ? "opacity-50" : ""}`}
    />
  );
}

/**
 * One `query.stats` group, laid out like the trade site's filter panel: the
 * group's name and type, its own range when the type carries one, then a row
 * per stat.
 */
function StatGroup({ group, onGroupChange, onFilterChange, onFilterRemove }) {
  const label = statGroupLabel(group.type);
  const help = statGroupHelp(group.type);

  return (
    <div className="bg-bg border border-border rounded-lg px-2.5 pt-2 pb-2.5">
      <div className="flex items-center gap-2 flex-wrap pb-2 mb-2.5 border-b border-border">
        <input
          type="checkbox"
          checked={!group.disabled}
          title={group.disabled ? "Enable this group" : "Disable this group"}
          onChange={(e) => onGroupChange(group, { disabled: !e.target.checked })}
          className="flex-shrink-0 accent-accent"
        />
        <span
          className={`text-[11px] uppercase tracking-wide font-semibold ${
            group.disabled ? "text-muted/50 line-through" : "text-muted"
          }`}
        >
          {label}
        </span>
        {help ? (
          <span className="text-[11px] text-muted/60 cursor-help" title={help}>
            (?)
          </span>
        ) : null}
        <span className="flex-1 min-w-0" />
        {statGroupHasBounds(group.type) ? (
          <>
            <BoundInput
              label="min"
              value={group.min}
              dimmed={group.disabled}
              onCommit={(text) => onGroupChange(group, { min: parseStatBound(text) })}
            />
            <BoundInput
              label="max"
              value={group.max}
              dimmed={group.disabled}
              onCommit={(text) => onGroupChange(group, { max: parseStatBound(text) })}
            />
            <span className="w-[26px] flex-shrink-0" />
          </>
        ) : null}
      </div>

      <div className={`flex flex-col gap-1 ${group.disabled ? "opacity-50" : ""}`}>
        {group.filters.map((f) => (
          <div
            key={`${f.groupIndex}.${f.filterIndex}.${f.id}`}
            className="flex items-center gap-2 flex-wrap"
          >
            <input
              type="checkbox"
              checked={!f.disabled}
              title={f.disabled ? "Enable this filter" : "Disable this filter"}
              onChange={(e) => onFilterChange(f, { disabled: !e.target.checked })}
              className="flex-shrink-0 accent-accent"
            />
            <span
              className={`flex-1 min-w-[140px] text-[12px] uppercase tracking-wide truncate ${
                f.disabled ? "text-muted/50 line-through" : "text-text"
              }`}
              title={f.text}
            >
              {f.text}
            </span>
            <BoundInput
              label="min"
              value={f.min}
              dimmed={f.disabled}
              onCommit={(text) => onFilterChange(f, { min: parseStatBound(text) })}
            />
            <BoundInput
              label="max"
              value={f.max}
              dimmed={f.disabled}
              onCommit={(text) => onFilterChange(f, { max: parseStatBound(text) })}
            />
            <div
              title="Remove this filter"
              onClick={() => onFilterRemove(f)}
              className="text-muted hover:text-red-400 hover:bg-red-400/10 cursor-pointer text-base leading-none px-1.5 py-0.5 rounded-md flex-shrink-0"
            >
              ×
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TradeConfigRow({
  config,
  summary,
  groups,
  onSearch,
  onDelete,
  onEdit,
  onGroupChange,
  onFilterChange,
  onFilterRemove,
  copied,
}) {
  // Filters stay hidden until asked for, so a list of configs reads as a list
  // of names rather than a wall of stat rows.
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-panel2 border border-border rounded-xl px-3 py-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={open ? "Hide stat filters" : "Show stat filters"}
          className="flex-1 min-w-[140px] text-left flex items-center gap-2"
        >
          <span className="text-muted text-[10px] leading-none w-2.5 flex-shrink-0">
            {open ? "▼" : "▶"}
          </span>
          <span className="min-w-0 flex-1 flex items-baseline gap-2">
            <span className="text-[12.5px] font-semibold truncate">{config.name}</span>
            {summary ? (
              <span className="text-[11px] text-muted truncate">{summary}</span>
            ) : null}
          </span>
        </button>
        <button
          onClick={() => onEdit(config)}
          title="Edit payload JSON"
          className="flex-shrink-0 bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px]"
        >
          Edit
        </button>
        <button
          onClick={() => onSearch(config)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] ${
            copied
              ? "bg-transparent border border-accent2/40 text-accent2"
              : "bg-accent text-white font-medium"
          }`}
        >
          {copied ? "Copied" : "Search"}
        </button>
        <div
          className="text-muted hover:text-red-400 hover:bg-red-400/10 cursor-pointer text-base leading-none px-1.5 py-0.5 rounded-md flex-shrink-0"
          onClick={() => onDelete(config.id)}
        >
          ×
        </div>
      </div>

      {!open ? null : groups.length === 0 ? (
        <div className="mt-2.5 text-[12.5px] text-muted">This config has no stat filters.</div>
      ) : (
        <div className="mt-2.5 flex flex-col gap-2.5">
          {groups.map((group) => (
            <StatGroup
              key={group.groupIndex}
              group={group}
              onGroupChange={onGroupChange}
              onFilterChange={onFilterChange}
              onFilterRemove={onFilterRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
