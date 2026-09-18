"use client";

import { useState } from "react";
import { SubSidebar, SubItem, ContentPane } from "@/components/SubSidebar";
import { EmptyState } from "@/components/ItemRow";

const SECTIONS = [
  { id: "regex", label: "Regex", desc: "Search pattern builder", icon: "⌕" },
  { id: "trade", label: "Trade", desc: "Saved trade searches", icon: "⇄" },
  { id: "note", label: "Note", desc: "League notes", icon: "✎" },
];

export default function PoePage() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const active = SECTIONS.find((s) => s.id === activeId) || SECTIONS[0];

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
            <div className="text-[12.5px] text-muted mt-0.5">{active.desc}</div>
          </div>

          <EmptyState text={`${active.label} — nothing here yet.`} />
        </div>
      </ContentPane>
    </>
  );
}
