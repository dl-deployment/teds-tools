"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { SubSidebar, SubItem, ContentPane } from "@/components/SubSidebar";
import { MarkdownPanel } from "@/components/texttools/MarkdownPanel";
import { textToolList } from "@/lib/tools";

const ghostBtnClass =
  "bg-transparent border border-border text-text px-3 py-1.5 rounded-lg text-[12.5px] hover:bg-panel2";
const runBtnClass = "bg-accent text-white px-3.5 py-2 rounded-lg text-[13.5px] font-medium hover:brightness-110";

export default function TextToolsPage() {
  const [activeKey, setActiveKey] = useState(textToolList[0].key);
  const [text, setText] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const active = textToolList.find((t) => t.key === activeKey) || textToolList[0];
  const actions = active.options || [{ label: active.name, action: active.action }];
  const stats = useMemo(() => getStats(text), [text]);

  const showToast = useCallback((message, type = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  async function applyTool(action) {
    if (!text) return;
    try {
      setText(await action(text));
      showToast("Done");
    } catch (e) {
      showToast("Error: invalid input", "error");
    }
  }

  function handleCopy() {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => showToast("Copied"),
      () => showToast("Copy failed", "error")
    );
  }

  return (
    <>
      <SubSidebar title="Text Tools">
        {textToolList.map((tool) => (
          <SubItem
            key={tool.key}
            active={tool.key === active.key}
            onClick={() => setActiveKey(tool.key)}
            label={tool.name}
            sub={tool.desc}
            icon={
              <span
                className={`w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5 ${tool.colorClass}`}
              >
                {tool.icon}
              </span>
            }
          />
        ))}
      </SubSidebar>

      <ContentPane>
        <div className="bg-panel border border-border rounded-card px-4.5 pt-4.5 pb-4.5">
          <div className="flex justify-between items-start gap-3 mb-3">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold">{active.name}</div>
              <div className="text-[12.5px] text-muted mt-0.5">{active.desc}</div>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              {/* MarkDown shows the rendered result, so there is no source in
                  the buffer worth copying — only the clear/drop-again cycle. */}
              {active.key !== "md" && (
                <button onClick={handleCopy} className={ghostBtnClass}>Copy</button>
              )}
              <button onClick={() => setText("")} className={ghostBtnClass}>Clear</button>
            </div>
          </div>

          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {actions.map((opt) => (
                <button key={opt.label} onClick={() => applyTool(opt.action)} className={runBtnClass}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {active.key === "md" ? (
            <MarkdownPanel text={text} setText={setText} showToast={showToast} />
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste or type text here, then run a tool — results replace the text in place."
              spellCheck={false}
              className="w-full min-h-[420px] resize-y bg-bg border border-border text-text px-2.5 py-2 rounded-lg text-[13px] font-mono"
            />
          )}

          {/* MarkDown shows the rendered result, not the buffer, so buffer
              stats would describe text that isn't on screen. */}
          {active.key !== "md" && (
            <div className="flex gap-4 mt-2.5 text-[11px] text-muted">
              <span>{stats.chars} chars</span>
              <span>{stats.words} words</span>
              <span>{stats.lines} lines</span>
            </div>
          )}
        </div>

        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-20 px-3.5 py-2 rounded-lg text-[12.5px] bg-panel2 border ${
              toast.type === "error" ? "border-red-400/40 text-red-400" : "border-accent2/40 text-accent2"
            }`}
          >
            {toast.message}
          </div>
        )}
      </ContentPane>
    </>
  );
}

function getStats(text) {
  if (!text) return { chars: 0, words: 0, lines: 0 };
  return {
    chars: text.length,
    words: text.trim() ? text.trim().split(/\s+/).length : 0,
    lines: text.split("\n").length,
  };
}
