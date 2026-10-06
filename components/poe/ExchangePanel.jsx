"use client";

import { Fragment, useEffect, useState } from "react";
import { EmptyState } from "@/components/ItemRow";
import NumberField from "./NumberField";
import { downloadBlob } from "@/lib/zip";
import {
  CYCLE_SHAPES,
  EXAMPLE_RATES,
  EXCHANGE_COST_FILE,
  EXCHANGE_GROUPS,
  buildExchangeCostMap,
  chainRun,
  exchangeCost,
  formatRate,
  formatRateFixed,
  groupNumber,
  normalizeExchangeGroup,
  pairFromRateCell,
  parseNumberField,
  rateFromPair,
  roundAmounts,
  summarizeExchangeCosts,
} from "@/lib/poe";

const TABS = [
  { id: "duo", label: "Duo Exchange" },
  { id: "triple", label: "Triple Exchange" },
  { id: "cost", label: "Exchange Cost" },
  { id: "example", label: "Example Rate" },
];

const ghostBtn =
  "flex-shrink-0 bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px] disabled:opacity-40";

const fieldClass =
  "bg-bg border border-border text-text px-2.5 py-1.5 rounded-lg text-[13px]";

const removeBtn =
  "text-muted hover:text-red-400 hover:bg-red-400/10 cursor-pointer text-base leading-none px-1.5 py-0.5 rounded-md flex-shrink-0";

const editBtn =
  "flex-shrink-0 bg-transparent border border-border text-muted hover:text-text px-2 py-1 rounded-md text-[11.5px]";

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
 * The card's grid, shared by both cycle tabs. Each round is two lines deep — a
 * rate line whose items sit at the outer edges with one count either side of the
 * mid-line, and a figures line under it — with a rule between the rounds.
 * `minmax(0,…)` on every column so a long figure truncates instead of pushing
 * the card wide; the `minWidth` is the floor the wrapper scrolls against on a
 * narrow screen.
 */
const chainColumns = [
  "minmax(0,1fr)",
  "minmax(0,1.1fr)",
  "minmax(0,1.1fr)",
  "minmax(0,1fr)",
];

const chainGrid = {
  gridTemplateColumns: chainColumns.join(" "),
  minWidth: "690px",
};

const chainRow = "grid items-center gap-x-2 gap-y-2";

/** The rule the card's right-hand half hangs off. */
const chainDivider =
  "min-w-0 self-stretch border-l border-border pl-2.5 flex flex-col justify-center";

/** A cell's small caption, the one line above a figure or a control. */
const chainCaption = "truncate text-[10px] uppercase tracking-wide text-muted";

/** One cell: a small caption over a figure, or over the control in its place. */
function ChainCell({ label, title, value = "", tone = "text-text", children }) {
  return (
    <div className="min-w-0" title={title}>
      <div className={chainCaption}>{label}</div>
      {children ?? <div className={`truncate font-mono text-[12.5px] ${tone}`}>{value}</div>}
    </div>
  );
}

/**
 * A round's amount cell: what the round works out to, and beside it the same
 * trade at its roundest — the smallest whole numbers in that ratio, so a round
 * buying 9.5 for 1 reads as one buying 19 for 2. Each box carries its own
 * caption; the pair is one suggestion, so both cells of a round show the same
 * two numbers, each its own side.
 */
function AmountCell({ label, title, current, suggested, hint }) {
  return (
    <div className="flex items-start gap-1" title={title}>
      <div className="min-w-0 flex-1">
        <div className={chainCaption}>{label}</div>
        {current}
      </div>
      <div className="min-w-0 flex-1" title={hint}>
        <div className={chainCaption}>{`suggest ${label}`}</div>
        <div className={chainBox}>{suggested}</div>
      </div>
    </div>
  );
}

/**
 * The frame a read-only cell draws: the editable boxes' shape, so the row still
 * lines up, but outlined rather than filled and dashed rather than solid, so
 * nothing that can't be typed into reads as a field.
 */
const chainReadOnly = "bg-transparent border border-dashed border-border rounded-lg";

/** A cell's computed figure. */
const chainBox = `min-w-0 truncate ${chainReadOnly} px-1.5 py-1 text-center font-mono text-[12.5px] text-muted`;

/** An item's name where a picker would be: every sighting after it is picked. */
const chainNameBox = `min-w-0 truncate ${chainReadOnly} px-2 py-1.5 text-[12.5px] text-muted`;

/** A rule across the whole card, splitting it into its rounds and its totals. */
const chainRule = { gridColumn: "1 / -1" };

/**
 * One half of a round's rate: how much of the item beside it. The two halves sit
 * either side of the mid-line, so "5 : 10" reads five of the left item for ten
 * of the right — the left count is the one got, the right count the one spent.
 */
function RateBox({ itemName, role, value, onCommit }) {
  return (
    <div className="min-w-0" title={`${role} of ${itemName || "this item"}`}>
      <NumberField className="w-full" placeholder="qty" value={value} onCommit={onCommit} />
    </div>
  );
}

/**
 * One Exchange group — a Duo card's two trades or a Triple card's three —
 * drawn as a round each: the line stating the rate (the count got either side of
 * the mid-line, the two items outside it) and the line working it out (what the
 * spent amount buys, and what that is worth at the Exchange Cost list). A rule
 * splits the rounds from each other and from the totals that close the card.
 *
 * The shape decides how many rounds there are and which items each touches. An
 * item is picked in the round it first appears in and named read-only after
 * that, and every round but the first spends what the one before it bought, so
 * only the first round's amount is typed.
 *
 * The items are held by name so the card can mark one the cost list no longer
 * has rather than dropping the group.
 */
function ChainCard({ shape, group, costs, names, onUpdate, onRemove }) {
  const set = (patch) => onUpdate(group.id, patch);
  const { itemFields, rateFields, amountFields, chain } = shape;

  // A round is named for the item it spends and buys the next one round, so the
  // price beside its `get` is that next item's.
  const spentField = amountFields[0];
  const gotField = (index) => itemFields[(index + 1) % itemFields.length];
  const costOf = (field) => exchangeCost(costs, group[field]);

  const run = chainRun({
    spent: group[spentField],
    rounds: rateFields.map((rateField, index) => ({
      rate: rateFromPair(group[rateField]),
      price: costOf(gotField(index)),
    })),
  });

  /** Computed figures are shown to four significant figures. */
  const figure = (value) => (value == null ? "—" : formatRate(value));

  /** A figure with the item's listed price — the base gold — after it. */
  const priced = (value, price) => (value == null ? "—" : `${figure(value)} (${figure(price)})`);

  return (
    <div className="bg-panel2 border border-border rounded-xl px-3 py-2.5 overflow-x-auto">
      <div className={chainRow} style={chainGrid}>
        {rateFields.map((rateField, index) => {
          const got = gotField(index);
          const spentItem = itemFields[index];
          const cell = pairFromRateCell(group[rateField]);
          const result = run.rounds[index];
          const previous = index === 0 ? null : run.rounds[index - 1];

          // The round's amounts at their roundest, whole numbers, plus the note
          // both amount cells carry.
          const pair = roundAmounts({ got: result.got, spent: result.spent });
          const whole = (value) => (value == null ? "—" : groupNumber(value));
          const roundest = { get: whole(pair.got), spent: whole(pair.spent) };
          const roundestHint =
            pair.got == null
              ? undefined
              : `The roundest trade: ${roundest.get} for ${roundest.spent}`;

          return (
            <Fragment key={rateField}>
              {index > 0 ? <div className="border-t border-border" style={chainRule} /> : null}

              {/* The rate: how much of each item, either side of the mid-line.
                  The items outside are picked the first time they come up. */}
              {index < itemFields.length - 1 ? (
                <ItemSelect
                  value={group[got]}
                  names={names}
                  onChange={(next) => set({ [got]: next })}
                />
              ) : (
                <span className={chainNameBox} title={group[got]}>
                  {group[got]}
                </span>
              )}
              <RateBox
                itemName={group[got]}
                role="Get quantity"
                value={cell.bought}
                onCommit={(text) =>
                  set({ [rateField]: { a: parseNumberField(text), b: cell.paid } })
                }
              />
              <div className={chainDivider}>
                <RateBox
                  itemName={group[spentItem]}
                  role="Spent quantity"
                  value={cell.paid}
                  onCommit={(text) =>
                    set({ [rateField]: { a: cell.bought, b: parseNumberField(text) } })
                  }
                />
              </div>
              {index === 0 ? (
                <ItemSelect
                  value={group[spentItem]}
                  names={names}
                  onChange={(next) => set({ [spentItem]: next })}
                />
              ) : (
                <span className={chainNameBox} title={group[spentItem]}>
                  {group[spentItem]}
                </span>
              )}

              {/* What this round buys and what it is worth — the listed price of
                  the got item follows the figure in brackets. */}
              <ChainCell
                label="cost"
                title={`What the ${group[got]} got is worth, with its listed price in brackets`}
                value={priced(result.gold, costOf(got))}
              />
              <AmountCell
                label="get"
                title={`How much ${group[got]} the spent ${group[spentItem]} buys`}
                current={<div className={chainBox}>{figure(result.got)}</div>}
                suggested={roundest.get}
                hint={roundestHint}
              />
              <div className={chainDivider}>
                <AmountCell
                  label="spent"
                  title={
                    index === 0
                      ? `How much ${group[spentItem]} this round spends`
                      : `The ${group[spentItem]} the round before got, spent here`
                  }
                  current={
                    index === 0 ? (
                      <NumberField
                        className="w-full"
                        group
                        placeholder="amount"
                        value={group[spentField]}
                        onCommit={(text) => set({ [spentField]: parseNumberField(text) })}
                      />
                    ) : (
                      <div className={chainBox}>{figure(previous.got)}</div>
                    )
                  }
                  suggested={roundest.spent}
                  hint={roundestHint}
                />
              </div>
              <span />
            </Fragment>
          );
        })}

        <div className="border-t border-border" style={chainRule} />

        {/* The rounds together, and what one round trip made. */}
        <ChainCell
          label="total cost"
          title="Every round's goods, added up — what the chain ties up"
          value={figure(run.totalGold)}
        />
        <ChainCell
          label="profit"
          tone={profitColor(run.profit)}
          title={`What the ${chain} trip gained, counted in ${group[itemFields[0]]}`}
          value={figure(run.profit)}
        />
        <div className={chainDivider}>
          <ChainCell
            label="gold / profit"
            title="The gold tied up for each one made"
            value={figure(run.goldPerProfit)}
          />
        </div>
        <div className="flex justify-end">
          <div title="Remove this group" className={removeBtn} onClick={() => onRemove(group.id)}>
            ×
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One tab's worth of chains: the list of cards, and the button that starts a new
 * one. A group trades the items in its shape — two for Duo, three for Triple —
 * so the cost list needs at least that many priced entries before one can be
 * made.
 */
function ChainPanel({ shape, costs, groups, onAdd, onUpdate, onRemove }) {
  const names = costs.map((c) => c.name);
  const rounds = shape.rateFields.length;
  const needed = shape.itemFields.length;
  const ready = names.length >= needed;

  const add = () =>
    onAdd(Object.fromEntries(shape.itemFields.map((field, index) => [field, names[index]])));

  return (
    <>
      <div className="flex justify-between items-center gap-3 flex-wrap mb-2.5">
        <div className="text-[12.5px] text-muted">
          {groups.length} group{groups.length === 1 ? "" : "s"} — {rounds} trades chained through{" "}
          {needed} items, each with its own rate, priced against the Exchange Cost list. Give the
          first round the amount it spends and it works out what each round buys, what the run ties
          up and what the round trip makes.
        </div>
        <button onClick={add} disabled={!ready} className={ghostBtn}>
          + New group
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          text={
            ready
              ? "No groups yet — add one with + New group."
              : `Add ${needed} priced items in Exchange Cost, then trade them here.`
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <ChainCard
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
 * The Example Rate tab: a fixed ladder of rates, each a pair of counts with the
 * rate between them divided through to a single right-hand one — 3 ── 0.6 : 1 ──
 * 5. Nothing here is stored or edited: the rows are what `EXAMPLE_RATES`
 * carries, in the order it carries them, so the cards can be read against a
 * ladder that depends on nothing the user has entered. The middle column is a
 * fixed width so the numbers line up down the list.
 */
function ExampleRatePanel() {
  return (
    <>
      <div className="text-[12.5px] text-muted mb-2.5">
        {EXAMPLE_RATES.length} example rates — each a pair of numbers with the left one divided
        through to a single right one between them. In order of that rate.
      </div>

      <div className="flex flex-col gap-2">
        {EXAMPLE_RATES.map((row) => (
          <div
            key={`${row.b}-${row.a}`}
            className="grid grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)] items-center gap-3 bg-panel2 border border-border rounded-xl px-3 py-2"
            title={`${row.b} on the left buys ${row.a} on the right`}
          >
            <div className="flex justify-end">
              <div className={`${chainBox} w-16`}>{groupNumber(row.b)}</div>
            </div>
            <span className="flex items-center justify-center gap-2 whitespace-nowrap font-mono text-[12.5px]">
              <span className="text-muted">──</span>
              <span className="text-text">{formatRateFixed(row.b / row.a)} : 1</span>
              <span className="text-muted">──</span>
            </span>
            <div className={`${chainBox} w-16`}>{groupNumber(row.a)}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * The Exchange section: one item of the POE sub-sidebar, with its own tabs. The
 * cost list is the shared footing — the cycle tabs pick their items out of it
 * and price their rounds at it.
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
      ) : tab === "example" ? (
        <ExampleRatePanel />
      ) : (
        <ChainPanel key={tab} costs={costs} {...cycles[tab]} />
      )}
    </>
  );
}
