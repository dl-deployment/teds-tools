"use client";

import { useMemo, useState } from "react";
import { rgbToHex } from "@/lib/color";

const TYPES = ["linear", "radial", "conic"];
const ghostBtnClass =
  "bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px]";

export default function GradientGenerator({ rgb, onCopy }) {
  const [colors, setColors] = useState(() => [rgbToHex(rgb), "#FFFFFF"]);
  const [type, setType] = useState("linear");
  const [angle, setAngle] = useState(90);

  const cssValue = useMemo(() => {
    const stops = colors.join(", ");
    if (type === "linear") return `linear-gradient(${angle}deg, ${stops})`;
    if (type === "radial") return `radial-gradient(circle, ${stops})`;
    return `conic-gradient(from ${angle}deg, ${stops})`;
  }, [colors, type, angle]);

  const cssCode = `background: ${cssValue};`;

  function updateColor(i, val) {
    setColors(colors.map((c, idx) => (idx === i ? val : c)));
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="h-32 rounded-lg border border-border" style={{ background: cssValue }} />

      <div className="flex flex-wrap items-center gap-2">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-3 py-1.5 rounded-lg text-[12.5px] border ${
              type === t
                ? "bg-accent4/[0.18] border-accent4/40 text-text"
                : "bg-transparent border-border text-muted hover:text-text"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {type !== "radial" && (
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted uppercase tracking-wide">Angle</span>
          <input
            type="range"
            min={0}
            max={360}
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
            className="flex-1 accent-accent4"
          />
          <span className="text-[12.5px] text-muted w-9 text-right">{angle}°</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {colors.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5 bg-panel2 border border-border rounded-lg pl-1.5 pr-1 py-1">
            <div className="relative w-6 h-6 rounded-md border border-border" style={{ backgroundColor: c }}>
              <input
                type="color"
                value={c}
                onChange={(e) => updateColor(i, e.target.value.toUpperCase())}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <span className="text-[11px] text-muted">{c}</span>
            {colors.length > 2 && (
              <button
                onClick={() => setColors(colors.filter((_, idx) => idx !== i))}
                className="text-muted hover:text-red-400 px-1 text-[13px] leading-none"
                title="Remove stop"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {colors.length < 6 && (
          <button onClick={() => setColors([...colors, "#000000"])} className={ghostBtnClass}>
            + Add stop
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-2.5 py-2">
        <code className="flex-1 text-[12px] text-muted overflow-x-auto whitespace-nowrap">{cssCode}</code>
        <button onClick={() => onCopy(cssCode)} className={ghostBtnClass}>Copy CSS</button>
      </div>
    </div>
  );
}
