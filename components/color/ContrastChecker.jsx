"use client";

import { useEffect, useMemo, useState } from "react";
import { rgbToHex, hexToRgb, isValidHex, contrastRatio, wcagResults } from "@/lib/color";

const hexFieldClass = "w-full bg-bg border border-border text-text px-2 py-1.5 rounded-lg text-[12.5px]";
const swapBtnClass =
  "flex-shrink-0 bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[13px] leading-none";

export default function ContrastChecker({ initialFg }) {
  const [fg, setFg] = useState(initialFg);
  const [bg, setBg] = useState({ r: 255, g: 255, b: 255 });
  const [fgDraft, setFgDraft] = useState(rgbToHex(initialFg));
  const [bgDraft, setBgDraft] = useState("#FFFFFF");
  const [editingFg, setEditingFg] = useState(false);
  const [editingBg, setEditingBg] = useState(false);

  const fgHex = rgbToHex(fg);
  const bgHex = rgbToHex(bg);

  // Follow the shared color until the user edits the foreground field here.
  useEffect(() => {
    setFg(initialFg);
    if (!editingFg) setFgDraft(rgbToHex(initialFg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFg.r, initialFg.g, initialFg.b]);

  const ratio = useMemo(() => contrastRatio(fg, bg), [fg.r, fg.g, fg.b, bg.r, bg.g, bg.b]);
  const results = wcagResults(ratio);

  function swap() {
    setFg(bg);
    setBg(fg);
    setFgDraft(bgHex);
    setBgDraft(fgHex);
  }

  function commit(which) {
    if (which === "fg") {
      setEditingFg(false);
      if (isValidHex(fgDraft)) setFg(hexToRgb(fgDraft));
      else setFgDraft(fgHex);
    } else {
      setEditingBg(false);
      if (isValidHex(bgDraft)) setBg(hexToRgb(bgDraft));
      else setBgDraft(bgHex);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2.5">
        <ColorField
          label="Foreground"
          hex={fgHex}
          draft={fgDraft}
          editing={editingFg}
          onDraft={setFgDraft}
          onEdit={setEditingFg}
          onCommit={() => commit("fg")}
          onPick={setFg}
        />
        <button onClick={swap} className={`${swapBtnClass} mb-1`} title="Swap colors">⇄</button>
        <ColorField
          label="Background"
          hex={bgHex}
          draft={bgDraft}
          editing={editingBg}
          onDraft={setBgDraft}
          onEdit={setEditingBg}
          onCommit={() => commit("bg")}
          onPick={setBg}
        />
      </div>

      <div className="text-[22px] font-semibold">{ratio.toFixed(2)}:1</div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Result label="AA Normal" pass={results.aa.normal} />
        <Result label="AA Large" pass={results.aa.large} />
        <Result label="AAA Normal" pass={results.aaa.normal} />
        <Result label="AAA Large" pass={results.aaa.large} />
      </div>

      <div className="rounded-lg border border-border px-4 py-3" style={{ backgroundColor: bgHex, color: fgHex }}>
        <p className="text-[16px]">Normal text preview (16px)</p>
        <p className="text-[24px] font-bold">Large text preview (24px bold)</p>
      </div>
    </div>
  );
}

function ColorField({ label, hex, draft, editing, onDraft, onEdit, onCommit, onPick }) {
  return (
    <div>
      <div className="text-[12.5px] text-muted mb-1.5">{label}</div>
      <div className="flex items-center gap-1.5">
        <div
          className="relative w-9 h-9 flex-shrink-0 rounded-lg border border-border"
          style={{ backgroundColor: hex }}
        >
          <input
            type="color"
            value={hex}
            onChange={(e) => {
              onPick(hexToRgb(e.target.value));
              onDraft(e.target.value.toUpperCase());
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="Pick a color"
          />
        </div>
        <input
          type="text"
          value={editing ? draft : hex}
          spellCheck={false}
          onChange={(e) => {
            onEdit(true);
            onDraft(e.target.value);
          }}
          onBlur={onCommit}
          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          className={hexFieldClass}
        />
      </div>
    </div>
  );
}

function Result({ label, pass }) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 ${
        pass ? "border-accent2/40 text-accent2" : "border-red-400/40 text-red-400"
      }`}
    >
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-[12.5px] font-semibold">{pass ? "Pass" : "Fail"}</div>
    </div>
  );
}
