"use client";

import { useEffect, useState } from "react";
import { SubSidebar, SubItem, ContentPane } from "@/components/SubSidebar";
import { toolList, generateUuid, convertTimestamp, textDiff } from "@/lib/tools";
import { processEvents } from "@/lib/events";
import { formatDate, formatShortDate, getToday, monthName, solarToLunar } from "@/lib/lunar";

export default function ToolsPage() {
  const [activeKey, setActiveKey] = useState(toolList[0].key);
  const active = toolList.find((t) => t.key === activeKey) || toolList[0];

  return (
    <>
      <SubSidebar title="Tools">
        {toolList.map((t) => (
          <SubItem
            key={t.key}
            active={t.key === active.key}
            onClick={() => setActiveKey(t.key)}
            label={t.name}
            sub={t.desc}
            icon={
              <span
                className={`w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5 ${t.colorClass}`}
              >
                {t.icon}
              </span>
            }
          />
        ))}
      </SubSidebar>

      <ContentPane>
        <div className="bg-panel border border-border rounded-card px-4.5 pt-4.5 pb-4.5">
          <div className="text-[15px] font-semibold mb-3">{active.name}</div>
          {active.key === "uuid" && <UuidTool />}
          {active.key === "timestamp" && <TimestampTool />}
          {active.key === "diff" && <DiffTool />}
          {active.key === "timeline" && <EventTimelineTool />}
        </div>
      </ContentPane>
    </>
  );
}

const inputClass = "w-full bg-bg border border-border text-text px-2.5 py-2 rounded-lg text-[13.5px] min-h-[80px] resize-y";
const labelClass = "block text-[12.5px] text-muted mt-2.5 mb-1.5";
const runBtnClass = "bg-accent text-white px-3.5 py-2 rounded-lg text-[13.5px] font-medium";
function UuidTool() {
  // Filled in after mount: generating during prerender would produce a
  // different value on the server and client, breaking hydration.
  const [out, setOut] = useState("");
  useEffect(() => setOut(generateUuid()), []);
  return (
    <div>
      <div className="tool-output">{out}</div>
      <div className="flex justify-end mt-2">
        <button className={runBtnClass} onClick={() => setOut(generateUuid())}>
          Generate
        </button>
      </div>
    </div>
  );
}

function TimestampTool() {
  const [input, setInput] = useState("");
  const [out, setOut] = useState("");
  return (
    <div>
      <label className={labelClass}>Unix timestamp (seconds) — leave blank for now</label>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="1758172800"
        className="w-full bg-bg border border-border text-text px-2.5 py-2 rounded-lg text-[13.5px]"
      />
      <div className="flex justify-end mt-2">
        <button className={runBtnClass} onClick={() => setOut(convertTimestamp(input))}>
          Convert
        </button>
      </div>
      <div className="tool-output">{out}</div>
    </div>
  );
}

function DiffTool() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [out, setOut] = useState("");
  return (
    <div>
      <label className={labelClass}>Text A</label>
      <textarea value={a} onChange={(e) => setA(e.target.value)} placeholder="First text" className={inputClass} />
      <label className={labelClass}>Text B</label>
      <textarea value={b} onChange={(e) => setB(e.target.value)} placeholder="Second text" className={inputClass} />
      <div className="flex justify-end mt-2">
        <button className={runBtnClass} onClick={() => setOut(textDiff(a, b))}>
          Compare
        </button>
      </div>
      <div className="tool-output">{out}</div>
    </div>
  );
}

function EventTimelineTool() {
  // Processed after mount: the countdown depends on today's date, which would
  // differ between the prerendered HTML and the browser.
  const [events, setEvents] = useState([]);
  useEffect(() => setEvents(processEvents()), []);

  const today = getToday();
  const lunar = solarToLunar(today);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap gap-x-6 gap-y-1 bg-panel2 border border-border rounded-lg px-3.5 py-2.5">
        <span className="text-[12.5px] text-muted">
          Solar <span className="font-medium text-text">{formatDate(today)}</span>
        </span>
        <span className="text-[12.5px] text-muted">
          Lunar{" "}
          <span className="font-medium text-text">
            {lunar.day}/{lunar.month}/{lunar.year}
          </span>
        </span>
      </div>

      <ul>
        {events.map((ev, i) => (
          <EventCard key={`${ev.name}-${ev.solarDate}`} ev={ev} last={i === events.length - 1} />
        ))}
      </ul>
    </div>
  );
}

function EventCard({ ev, last }) {
  const { name, lunarDate, type, icon, note, eventDate, daysLeft } = ev;
  const isToday = daysLeft === 0;
  const isSoon = daysLeft > 0 && daysLeft <= 7;

  const dotClass = isToday ? "bg-accent2" : isSoon ? "bg-accent4" : "bg-border";
  // The resolved next occurrence, not the date recorded in the list — for a
  // lunar holiday those differ once the year rolls over.
  const dateText = formatShortDate(eventDate);

  return (
    <li className="flex flex-wrap gap-x-2.5">
      <div className="w-10 flex-shrink-0 pt-2 text-right">
        <div className="text-[15px] font-semibold leading-none">
          {String(eventDate.getDate()).padStart(2, "0")}
        </div>
        <div className="text-[10px] uppercase text-muted mt-1">
          {monthName(eventDate.getMonth())}
        </div>
      </div>

      <div className="flex flex-col items-center pt-3">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
        {!last && <span className="w-px flex-1 bg-border" />}
      </div>

      <div
        className={`flex-1 min-w-[min(180px,100%)] mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-panel2 border rounded-lg px-3 py-2.5 ${
          isToday ? "border-accent2/40" : "border-border"
        }`}
      >
        <span className="flex-shrink-0 text-[20px] leading-none" title={note || ""}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{name}</div>
          <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted mt-0.5">
            <span
              className={`px-1.5 py-px rounded-full ${
                type === "solar" ? "bg-accent4/15 text-accent4" : "bg-accent3/15 text-accent3"
              }`}
            >
              {type === "solar" ? "☀ Solar" : "☽ Lunar"}
            </span>
            <span>{type === "solar" ? dateText : `${lunarDate} · ${dateText}`}</span>
            {note && <span>· {note}</span>}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-[16px] font-semibold leading-none">{isToday ? "🎉" : daysLeft}</div>
          <span className="text-[10px] text-muted">{isToday ? "Today!" : "days"}</span>
        </div>
      </div>
    </li>
  );
}
