"use client";

import { EmptyState } from "@/components/ItemRow";

export default function LeaguePanel({ leagues, league, onSelect, refreshing, error, onRefresh }) {
  return (
    <>
      <div className="flex justify-between items-center gap-3 mb-2.5">
        <div className="text-[12.5px] text-muted">
          Trade searches in the Trade section run against this league.
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex-shrink-0 bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px] disabled:opacity-50"
        >
          {refreshing ? "Updating…" : "Update"}
        </button>
      </div>

      {error ? (
        <div className="text-[12.5px] text-muted mb-2.5">
          Couldn&apos;t reach the trade API ({error}) — showing the built-in list.
        </div>
      ) : null}

      {leagues.length === 0 ? (
        <EmptyState text="No leagues available." />
      ) : (
        leagues.map((name) => {
          const active = name === league;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onSelect(name)}
              className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] border mb-0.5 ${
                active
                  ? "bg-accent/[0.14] border-accent/30 text-text"
                  : "border-transparent text-muted hover:text-text hover:bg-panel2"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  active ? "bg-accent" : "bg-border"
                }`}
              />
              <span className="text-[13px] font-medium truncate">{name}</span>
            </button>
          );
        })
      )}
    </>
  );
}
