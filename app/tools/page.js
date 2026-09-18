"use client";

import { useState } from "react";
import { SubSidebar, SubItem, ContentPane } from "@/components/SubSidebar";
import { toolList, formatJson, base64Encode, base64Decode, generateUuid, convertTimestamp, textDiff } from "@/lib/tools";

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
          {active.key === "json" && <JsonTool />}
          {active.key === "base64" && <Base64Tool />}
          {active.key === "uuid" && <UuidTool />}
          {active.key === "timestamp" && <TimestampTool />}
          {active.key === "diff" && <DiffTool />}
        </div>
      </ContentPane>
    </>
  );
}

const inputClass = "w-full bg-bg border border-border text-text px-2.5 py-2 rounded-lg text-[13.5px] min-h-[80px] resize-y";
const labelClass = "block text-[12.5px] text-muted mt-2.5 mb-1.5";
const runBtnClass = "bg-accent text-white px-3.5 py-2 rounded-lg text-[13.5px] font-medium";
const ghostBtnClass = "bg-transparent border border-border text-text px-3.5 py-2 rounded-lg text-[13.5px]";

function JsonTool() {
  const [input, setInput] = useState("");
  const [out, setOut] = useState("");
  return (
    <div>
      <label className={labelClass}>Paste JSON</label>
      <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder='{"hello":"world"}' className={inputClass} />
      <div className="flex justify-end mt-2">
        <button className={runBtnClass} onClick={() => setOut(formatJson(input))}>
          Format
        </button>
      </div>
      <div className="tool-output">{out}</div>
    </div>
  );
}

function Base64Tool() {
  const [input, setInput] = useState("");
  const [out, setOut] = useState("");
  return (
    <div>
      <label className={labelClass}>Text</label>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type text to encode, or Base64 to decode"
        className={inputClass}
      />
      <div className="flex justify-end gap-2 mt-2">
        <button className={ghostBtnClass} onClick={() => setOut(base64Decode(input))}>
          Decode
        </button>
        <button className={runBtnClass} onClick={() => setOut(base64Encode(input))}>
          Encode
        </button>
      </div>
      <div className="tool-output">{out}</div>
    </div>
  );
}

function UuidTool() {
  const [out, setOut] = useState(() => generateUuid());
  return (
    <div>
      <div className="flex justify-end mt-0">
        <button className={runBtnClass} onClick={() => setOut(generateUuid())}>
          Generate
        </button>
      </div>
      <div className="tool-output">{out}</div>
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
