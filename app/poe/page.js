"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SubSidebar, SubItem, ContentPane } from "@/components/SubSidebar";
import { EmptyState } from "@/components/ItemRow";
import { useHubData } from "@/lib/useHubData";
import { FALLBACK_LEAGUES, extractStatFilters } from "@/lib/poe";
import TradePanel from "@/components/poe/TradePanel";
import MakerPanel from "@/components/poe/MakerPanel";
import LeaguePanel from "@/components/poe/LeaguePanel";
import SystemPanel from "@/components/poe/SystemPanel";
import { fetchPoe2Leagues, fetchStatTexts } from "./actions";

const SECTIONS = [
  { id: "trade", label: "Trade", desc: "Saved trade searches", icon: "⇄" },
  { id: "maker", label: "Maker", desc: "Merge stat groups into a search", icon: "⊕" },
  { id: "league", label: "League", desc: "Trade league", icon: "◍" },
  { id: "regex", label: "Regex", desc: "Search pattern builder", icon: "⌕" },
  { id: "note", label: "Note", desc: "League notes", icon: "✎" },
  { id: "system", label: "System", desc: "Export / import data", icon: "⛁" },
];

export default function PoePage() {
  // One hook instance per page: two would each read-modify-write the same
  // localStorage key, so one could clobber the other's writes.
  const {
    ready,
    tradeConfigs,
    makerGroups,
    bundledPayloads,
    poeLeague,
    addTradeConfig,
    updateTradeConfig,
    removeTradeConfig,
    addMakerGroup,
    removeMakerGroup,
    setPoeLeague,
    replacePoeData,
  } = useHubData();

  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const [leagues, setLeagues] = useState(FALLBACK_LEAGUES);
  const [leagueError, setLeagueError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [statTexts, setStatTexts] = useState({});
  const fetched = useRef(false);
  // Ids already resolved or in flight. `null` marks one the trade API doesn't
  // know, so it isn't retried; a failed request releases its ids instead.
  const statIds = useRef(new Set());

  const active = SECTIONS.find((s) => s.id === activeId) || SECTIONS[0];

  const refreshLeagues = useCallback(async () => {
    setRefreshing(true);
    const res = await fetchPoe2Leagues();
    if (res.ok) {
      setLeagues(res.leagues);
      setLeagueError("");
    } else {
      setLeagueError(res.reason);
    }
    setRefreshing(false);
  }, []);

  // Only on opening the tab (not on page load), and once — switching away and
  // back reuses the cached list until Update is pressed.
  useEffect(() => {
    if (activeId !== "league" || fetched.current) return;
    fetched.current = true;
    refreshLeagues();
  }, [activeId, refreshLeagues]);

  // Stat names come from the trade API, so they're resolved server-side, only
  // while the Trade tab is open, and only for ids not already asked for.
  useEffect(() => {
    if (activeId !== "trade") return;

    const wanted = [];
    for (const config of tradeConfigs) {
      for (const filter of extractStatFilters(config.payload)) {
        if (!statIds.current.has(filter.id)) {
          statIds.current.add(filter.id);
          wanted.push(filter.id);
        }
      }
    }
    if (wanted.length === 0) return;

    fetchStatTexts(wanted).then((res) => {
      if (res.ok) {
        setStatTexts((prev) => ({ ...prev, ...res.texts }));
      } else {
        // Let a later visit retry rather than stranding these on raw ids.
        for (const id of wanted) statIds.current.delete(id);
      }
    });
  }, [activeId, tradeConfigs]);

  return (
    <>
      <SubSidebar title="POE Tools">
        {SECTIONS.map((s) => (
          <SubItem
            key={s.id}
            active={s.id === active.id}
            onClick={() => setActiveId(s.id)}
            label={s.label}
            sub={s.desc}
            icon={
              <span className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5 bg-accent/20 text-accent">
                {s.icon}
              </span>
            }
          />
        ))}
      </SubSidebar>

      <ContentPane>
        <div className="bg-panel border border-border rounded-card px-4.5 pt-4.5 pb-4.5">
          <div className="mb-3">
            <div className="text-[15px] font-semibold">{active.label}</div>
            <div className="text-[12.5px] text-muted mt-0.5">
              {active.id === "league"
                ? `Selected: ${poeLeague}`
                : active.id === "trade" || active.id === "maker"
                ? `${active.desc} — run against ${poeLeague}`
                : active.desc}
            </div>
          </div>

          {activeId === "trade" && (
            <TradePanel
              ready={ready}
              configs={tradeConfigs}
              bundledPayloads={bundledPayloads}
              league={poeLeague}
              statTexts={statTexts}
              onAdd={addTradeConfig}
              onUpdate={updateTradeConfig}
              onRemove={removeTradeConfig}
            />
          )}

          {activeId === "maker" && (
            <MakerPanel
              ready={ready}
              savedGroups={makerGroups}
              league={poeLeague}
              onAddGroup={addMakerGroup}
              onRemoveGroup={removeMakerGroup}
              onAddConfig={addTradeConfig}
            />
          )}

          {activeId === "league" && (
            <LeaguePanel
              leagues={leagues}
              league={poeLeague}
              onSelect={setPoeLeague}
              refreshing={refreshing}
              error={leagueError}
              onRefresh={refreshLeagues}
            />
          )}

          {activeId === "system" && (
            <SystemPanel
              ready={ready}
              tradeConfigs={tradeConfigs}
              makerGroups={makerGroups}
              poeLeague={poeLeague}
              onReplace={replacePoeData}
            />
          )}

          {activeId !== "trade" &&
            activeId !== "maker" &&
            activeId !== "league" &&
            activeId !== "system" && (
              <EmptyState text={`${active.label} — nothing here yet.`} />
            )}
        </div>
      </ContentPane>
    </>
  );
}
