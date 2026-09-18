"use client";

import Link from "next/link";
import { useHubData } from "@/lib/useHubData";
import { NoteRow, LinkRow, EmptyState } from "@/components/ItemRow";
import { ContentPane } from "@/components/SubSidebar";

export default function HomePage() {
  const { ready, notes, links, removeNote, removeLink } = useHubData();

  const recentNotes = [...notes].reverse().slice(0, 3);
  const recentLinks = [...links].reverse().slice(0, 3);

  return (
    <ContentPane>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
        <StatCard href="/tools" iconBg="bg-accent/[0.18] text-accent" icon="⚙" label="Tools" value={5} />
        <StatCard href="/notes" iconBg="bg-accent2/[0.18] text-accent2" icon="▤" label="Notes" value={ready ? notes.length : 0} />
        <StatCard href="/links" iconBg="bg-accent3/[0.18] text-accent3" icon="⛓" label="Links" value={ready ? links.length : 0} />
      </div>

      <div className="bg-panel border border-border rounded-card px-4.5 pt-4.5 pb-2 mb-4.5">
        <div className="flex justify-between items-center mb-3">
          <div className="text-[15px] font-semibold">Recent notes</div>
          <Link href="/notes" className="text-[13px] border border-border rounded-lg px-3 py-1.5 hover:bg-panel2">
            View all
          </Link>
        </div>
        {recentNotes.length === 0 ? (
          <EmptyState text="No notes yet." />
        ) : (
          recentNotes.map((n) => <NoteRow key={n.id} note={n} onDelete={removeNote} />)
        )}
      </div>

      <div className="bg-panel border border-border rounded-card px-4.5 pt-4.5 pb-2 mb-4.5">
        <div className="flex justify-between items-center mb-3">
          <div className="text-[15px] font-semibold">Recent links</div>
          <Link href="/links" className="text-[13px] border border-border rounded-lg px-3 py-1.5 hover:bg-panel2">
            View all
          </Link>
        </div>
        {recentLinks.length === 0 ? (
          <EmptyState text="No links yet." />
        ) : (
          recentLinks.map((l) => <LinkRow key={l.id} link={l} onDelete={removeLink} />)
        )}
      </div>
    </ContentPane>
  );
}

function StatCard({ href, iconBg, icon, label, value }) {
  return (
    <Link
      href={href}
      className="bg-panel border border-border rounded-card p-4.5 flex items-center gap-3.5 hover:border-accent"
    >
      <div className={`w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-lg flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div>
        <div className="text-[13px] text-muted">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
      </div>
    </Link>
  );
}
