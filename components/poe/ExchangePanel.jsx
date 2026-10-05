"use client";

import { Fragment, useEffect, useState } from "react";
import { EmptyState } from "@/components/ItemRow";
import NumberField from "./NumberField";
import { downloadBlob } from "@/lib/zip";
import {
  CYCLE_SHAPES,
  EXCHANGE_COST_FILE,
  EXCHANGE_GROUPS,
  buildExchangeCostMap,
  cycleRun,
  exchangeCost,
  formatRate,
  groupNumber,
  normalizeExchangeGroup,
  parseNumberField,
  summarizeExchangeCosts,
} from "@/lib/poe";

const TABS = [
  { id: "duo", label: "Duo Exchange" },
  { id: "triple", label: "Triple Exchange" },
  { id: "cost", label: "Exchange Cost" },
];

const ghostBtn =
  "flex-shrink-0 bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px] disabled:opacity-40";

const fieldClass =
  "bg-bg border border-border text-text px-2.5 py-1.5 rounded-lg text-[13px]";

const removeBtn =
  "text-muted hover:text-red-400 hover:bg-red-400/10 cursor-pointer text-base leading-none px-1.5 py-0.5 rounded-md flex-shrink-0";

const editBtn =
  "flex-shrink-0 bg-transparent border border-border text-muted hover:text-text px-2 py-1 rounded-md text-[11.5px]";

/** The label column a cycle card's Amount and Gold rows line up on. */
const rowLabel = "min-w-0 truncate text-[11px] uppercase tracking-wide text-muted";

/**
 * A cycle card's columns: a label, then an item box with the dash-rate-dash run
 * out of it, repeated along the chain, and finally the Result column and the
 * remove button. They are written out here rather than as a Tailwind class
 * because how many legs the cycle has is what decides how long it is.
 *
 * The returned `floor` is the narrowest the grid can get — every fixed column,
 * every item box at its 72px minimum, and the gaps between them — which is what
 * the card uses as its scroll floor.
 */
function cycleGrid(legs) {
  const columns = ["68px"];
  for (let i = 0; i <= legs; i += 1) {
    columns.push("minmax(72px,1fr)");
    if (i < legs) columns.push("16px", "68px", "16px");
  }
  columns.push("96px", "26px");

  const floor = 190 + 100 * legs + 72 * (legs + 1) + 6 * (columns.length - 1);
  return { template: columns.join(" "), floor: `${floor}px` };
}

/**
 * The column each item box sits in, and the column the Result column takes.
 * The chain's stride is four per item: the box itself, then a dash, the rate
 * leaving it and another dash.
 */
const itemColumn = (index) => 2 + index * 4;
const resultColumn = (legs) => 4 * legs + 3;

/** Gain green, loss red, nothing to say in muted. */
const profitColor = (value) =>
  value > 0 ? "text-accent2" : value < 0 ? "text-red-400" : "text-muted";

/**
 * The card's closing column, ruled off from the chain. It stretches so its
 * divider runs the full height of the row while the figures inside stay
 * centred against the item columns beside them.
 */
const resultCell =
  "self-stretch border-l border-border flex items-center justify-center min-w-0 px-1";

/**
 * The item name, committed on blur rather than per keystroke: a half-typed name
 * is neither unique nor worth writing, and a rename has to cascade to the Duo
 * groups that reference it. `onCommit` returns false to refuse a name, and the
 * box then falls back to the stored one.
 */
function NameInput({ value, onCommit }) {
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);

  return (
    <input
      type="text"
      value={text}
      placeholder="Item name"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (onCommit(text) === false) setText(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={`flex-1 min-w-0 ${fieldClass}`}
    />
  );
}

/**
 * Picks one item out of the cost list. A group can outlive the item it names —
 * deleting a cost row is allowed — so a name the list no longer has stays
 * selected and is marked rather than silently jumping to another item.
 */
function ItemSelect({ value, names, onChange }) {
  const missing = value && !names.includes(value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-w-0 bg-bg border border-border text-text rounded-lg px-2 py-1.5 text-[12.5px] [color-scheme:dark]"
    >
      {missing ? <option value={value}>{value} (not in cost list)</option> : null}
      {names.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

/**
 * One item and the price the Duo tab compares rates against. Every row is
 * editable and deletable, including the ones the bundled file seeded — the seed
 * only runs once, so removing a seeded item sticks.
 */
function ExchangeCostPanel({ costs, onAdd, onUpdate, onRemove }) {
  const [tab, setTab] = useState(EXCHANGE_GROUPS[0]);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [costText, setCostText] = useState("");
  const [error, setError] = useState("");

  const activeGroup = EXCHANGE_GROUPS.includes(tab) ? tab : EXCHANGE_GROUPS[0];
  const items = costs.filter((c) => normalizeExchangeGroup(c.group) === activeGroup);
  const countIn = (group) => costs.filter((c) => normalizeExchangeGroup(c.group) === group).length;

  function add() {
    const value = parseNumberField(costText);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the item a name.");
      return;
    }
    if (value == null) {
      setError("Give the item a cost.");
      return;
    }
    if (costs.some((c) => c.name === trimmed)) {
      setError("That item is already in the list.");
      return;
    }
    onAdd({ name: trimmed, cost: value, group: activeGroup });
    setName("");
    setCostText("");
    setError("");
  }

  function rename(entry, text) {
    const next = text.trim();
    if (!next || costs.some((c) => c.id !== entry.id && c.name === next)) return false;
    onUpdate(entry.id, { name: next });
    return true;
  }

  /** The list in the shape of the bundled file, so a download can replace it. */
  function exportFile() {
    downloadBlob(
      new Blob([JSON.stringify(buildExchangeCostMap(costs), null, 2)], { type: "application/json" }),
      EXCHANGE_COST_FILE
    );
  }

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap pb-2.5 mb-3 border-b border-border">
        {EXCHANGE_GROUPS.map((g) => {
          const active = g === activeGroup;
          return (
            <button
              key={g}
              type="button"
              onClick={() => {
                setTab(g);
                setEditingId(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] border ${
                active
                  ? "bg-accent/[0.14] border-accent/30 text-text"
                  : "border-transparent text-muted hover:text-text hover:bg-panel2"
              }`}
            >
              {g}
              <span className="text-muted ml-1">({countIn(g)})</span>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between items-center gap-3 flex-wrap mb-2.5">
        <div className="text-[12.5px] text-muted">
          {summarizeExchangeCosts(costs)} — each priced in one shared unit, so only the ratios matter.
        </div>
        <button onClick={exportFile} disabled={costs.length === 0} className={ghostBtn}>
          Export .json
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          text={
            costs.length === 0
              ? `No items yet — add one below, or drop entries into public/poe/${EXCHANGE_COST_FILE}.`
              : `No ${activeGroup} items — add one below.`
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((entry) =>
            editingId === entry.id ? (
              <div
                key={entry.id}
                className="flex items-center gap-2 bg-panel2 border border-border rounded-xl px-3 py-2"
              >
                <NameInput value={entry.name} onCommit={(text) => rename(entry, text)} />
                <NumberField
                  className="w-28"
                  align="right"
                  group
                  placeholder="cost"
                  value={entry.cost}
                  onCommit={(text) => onUpdate(entry.id, { cost: parseNumberField(text) })}
                />
                <button onClick={() => setEditingId(null)} className={editBtn}>
                  Done
                </button>
                <div title="Remove this item" className={removeBtn} onClick={() => onRemove(entry.id)}>
                  ×
                </div>
              </div>
            ) : (
              <div
                key={entry.id}
                className="flex items-center gap-2 bg-panel2 border border-border rounded-xl px-3 py-2"
              >
                <span className="flex-1 min-w-0 truncate text-[13px] text-text">{entry.name}</span>
                <span className="w-28 flex-shrink-0 text-right font-mono text-[12.5px] text-text">
                  {groupNumber(entry.cost)}
                </span>
                <button onClick={() => setEditingId(entry.id)} className={editBtn}>
                  Edit
                </button>
                <div title="Remove this item" className={removeBtn} onClick={() => onRemove(entry.id)}>
                  ×
                </div>
              </div>
            )
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2.5 bg-panel2 border border-dashed border-border rounded-xl px-3 py-2">
        <input
          type="text"
          value={name}
          placeholder={`Add to ${activeGroup}`}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          className={`flex-1 min-w-0 ${fieldClass}`}
        />
        <input
          type="number"
          step="any"
          inputMode="decimal"
          value={costText}
          placeholder="cost"
          onChange={(e) => {
            setCostText(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          className={`w-24 flex-shrink-0 text-right font-mono ${fieldClass}`}
        />
        <button onClick={add} className={ghostBtn}>
          + Add
        </button>
      </div>

      {error ? <div className="text-[12.5px] text-red-400 mt-2">{error}</div> : null}
    </>
  );
}

/**
 * One cycle card — A → B → A on the Duo tab, A → B → C → A on the Triple one —
 * laid out as a grid so each figure sits under the part of the chain it belongs
 * to: what the run leaves you holding on one row, and what each holding is worth
 * at the Exchange Cost list's prices on the next.
 *
 * The chain is positional, so the card is driven by the tab's `shape` rather
 * than by named fields, which is all that differs between the two tabs.
 */
function CycleCard({ shape, group, costs, names, onUpdate, onRemove }) {
  const { itemFields, rateFields } = shape;
  const legs = rateFields.length;

  // The chain in order, with the first item repeated at the end: the cycle
  // closes on the item it started from, so that last box is the first select
  // read back rather than a field of its own.
  const chain = [...itemFields.map((field) => group[field]), group[itemFields[0]]];
  const prices = chain.map((name) => exchangeCost(costs, name));

  // Leg `i` leaves you holding `chain[i + 1]`, so its price is the one after.
  const run = cycleRun({
    base: group.base,
    legs: rateFields.map((field, i) => ({ rate: group[field], cost: prices[i + 1] })),
  });

  const grid = cycleGrid(legs);
  const gridStyle = { gridTemplateColumns: grid.template, minWidth: grid.floor };
  const rowClass = "grid items-center gap-x-1.5";
  const figure = "min-w-0 truncate text-center text-[12px] text-muted";

  const set = (patch) => onUpdate(group.id, patch);

  // The gold the run ties up, with the gold it costs per one made beside it.
  // A break-even run has no ratio to show, so it prints the total on its own.
  const goldResult =
    run.totalGold == null
      ? ""
      : run.goldPerProfit == null
        ? formatRate(run.totalGold)
        : `${formatRate(run.totalGold)} (${formatRate(run.goldPerProfit)})`;

  return (
    <div className="bg-panel2 border border-border rounded-xl px-3 py-2.5 overflow-x-auto">
      <div className={rowClass} style={gridStyle}>
        <span />
        {chain.map((name, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <>
                <span className="text-center text-muted">──</span>
                <NumberField
                  className="w-full"
                  placeholder="rate"
                  value={group[rateFields[index - 1]]}
                  onCommit={(text) => set({ [rateFields[index - 1]]: parseNumberField(text) })}
                />
                <span className="text-center text-muted">──</span>
              </>
            ) : null}
            {index < chain.length - 1 ? (
              <ItemSelect
                value={name}
                names={names}
                onChange={(next) => set({ [itemFields[index]]: next })}
              />
            ) : (
              <span
                title={`Same as ${chain[0]} — the cycle closes here`}
                className="bg-bg border border-border text-muted rounded-lg px-2 py-1.5 text-[12.5px] truncate"
              >
                {name}
              </span>
            )}
          </Fragment>
        ))}
        <span className={`${resultCell} text-[11px] uppercase tracking-wide text-muted`}>Result</span>
        <div title="Remove this group" className={removeBtn} onClick={() => onRemove(group.id)}>
          ×
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-border">
        {/* The amount to invest sits under the first item it is spent on; the
            figures beside it are what the run leaves you holding of each item,
            and the Result column is what it made or lost overall. */}
        <div className={rowClass} style={gridStyle}>
          <span className={rowLabel}>Amount</span>
          <NumberField
            className="w-full"
            group
            placeholder="Invest"
            value={group.base}
            onCommit={(text) => set({ base: parseNumberField(text) })}
          />
          {run.amounts.map((amount, i) => (
            <span
              key={chain[i + 1]}
              className={figure}
              style={{ gridColumn: itemColumn(i + 1) }}
              title={
                i === 0
                  ? `${chain[0]} invested × rate into ${chain[1]}`
                  : `${chain[i]} × rate into ${chain[i + 1]}`
              }
            >
              {amount == null ? "" : formatRate(amount)}
            </span>
          ))}
          <span
            className={`${resultCell} text-[12px] ${profitColor(run.profit)}`}
            style={{ gridColumn: resultColumn(legs) }}
            title="What the round trip made or lost, in the A item"
          >
            {run.profit == null ? "" : formatRate(run.profit)}
          </span>
        </div>

        {/* What each hold is worth at the listed prices, and the lot together.
            Each leg carries the price of one unit beside it, so the figure can
            be read back to the Exchange Cost list it came from. */}
        <div className={`${rowClass} mt-1.5`} style={gridStyle}>
          <span className={rowLabel}>Gold</span>
          {run.golds.map((gold, i) => (
            <span
              key={chain[i + 1]}
              className={figure}
              style={{ gridColumn: itemColumn(i + 1) }}
              title={`${chain[i + 1]} price × the ${chain[i + 1]} get`}
            >
              {gold == null ? "" : `${formatRate(gold)} (${formatRate(prices[i + 1])})`}
            </span>
          ))}
          <span
            className={`${resultCell} text-[12px] text-muted`}
            style={{ gridColumn: resultColumn(legs) }}
            title="The figures to the left added up, and that total over the profit — what the run ties up, and what it costs per one made"
          >
            {goldResult}
          </span>
        </div>
      </div>
    </div>
  );
}

/** One tab's worth of cycles: the list, and the button that starts a new one. */
function CyclePanel({ shape, costs, groups, onAdd, onUpdate, onRemove }) {
  const names = costs.map((c) => c.name);
  const needed = shape.itemFields.length;

  function add() {
    const picked = {};
    shape.itemFields.forEach((field, i) => {
      picked[field] = names[i];
    });
    onAdd(picked);
  }

  return (
    <>
      <div className="flex justify-between items-center gap-3 flex-wrap mb-2.5">
        <div className="text-[12.5px] text-muted">
          {groups.length} group{groups.length === 1 ? "" : "s"} — each runs {shape.chain}, priced
          against the Exchange Cost list. Give one an amount to invest and it works out what the
          run returns, what it ties up and what it makes per gold.
        </div>
        <button onClick={add} disabled={names.length < needed} className={ghostBtn}>
          + New group
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          text={
            names.length < needed
              ? `Add at least ${needed} priced items in Exchange Cost, then cycle them here.`
              : "No groups yet — add one with + New group."
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <CycleCard
              key={group.id}
              shape={shape}
              group={group}
              costs={costs}
              names={names}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * The Exchange section: one item of the POE sub-sidebar, with its own three
 * tabs. The cost list is the shared footing — both cycle tabs pick their items
 * out of it and price their holdings at it.
 */
export default function ExchangePanel({
  ready,
  costs,
  duoGroups,
  tripleGroups,
  onAddCost,
  onUpdateCost,
  onRemoveCost,
  onAddDuo,
  onUpdateDuo,
  onRemoveDuo,
  onAddTriple,
  onUpdateTriple,
  onRemoveTriple,
}) {
  const [tab, setTab] = useState("duo");

  const cycles = {
    duo: {
      shape: CYCLE_SHAPES.duo,
      groups: duoGroups,
      onAdd: onAddDuo,
      onUpdate: onUpdateDuo,
      onRemove: onRemoveDuo,
    },
    triple: {
      shape: CYCLE_SHAPES.triple,
      groups: tripleGroups,
      onAdd: onAddTriple,
      onUpdate: onUpdateTriple,
      onRemove: onRemoveTriple,
    },
  };

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap pb-2.5 mb-3 border-b border-border">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] border ${
                active
                  ? "bg-accent/[0.14] border-accent/30 text-text"
                  : "border-transparent text-muted hover:text-text hover:bg-panel2"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {!ready ? (
        <EmptyState text="Loading…" />
      ) : tab === "cost" ? (
        <ExchangeCostPanel
          costs={costs}
          onAdd={onAddCost}
          onUpdate={onUpdateCost}
          onRemove={onRemoveCost}
        />
      ) : (
        <CyclePanel key={tab} costs={costs} {...cycles[tab]} />
      )}
    </>
  );
}
