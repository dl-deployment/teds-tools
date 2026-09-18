"use client";

import { useState } from "react";
import { isValidHex } from "@/lib/color";

const fieldClass =
  "w-full min-w-0 bg-bg border border-border text-text px-2 py-1.5 rounded-lg text-[12.5px] text-center";
const copyBtnClass =
  "flex-shrink-0 bg-transparent border border-border text-muted hover:text-text px-2 py-1 rounded-md text-[11px]";

export default function ColorInput({
  rgb, hex, hsl, hsv, cmyk,
  onHexChange, onRgbChange, onHslChange, onHsvChange, onCmykChange, onCopy,
}) {
  const [hexDraft, setHexDraft] = useState(hex);
  const [editingHex, setEditingHex] = useState(false);

  function commitHex() {
    setEditingHex(false);
    if (isValidHex(hexDraft)) onHexChange(hexDraft);
    else setHexDraft(hex);
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr] gap-4">
      <div
        className="relative h-40 rounded-lg border border-border flex items-center justify-center"
        style={{ backgroundColor: hex }}
      >
        <input
          type="color"
          value={hex}
          onChange={(e) => onHexChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          title="Pick a color"
        />
        <span className="text-[11px] text-white pointer-events-none [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
          Click to pick
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Row label="HEX" copy={() => onCopy(hex)}>
          <input
            type="text"
            value={editingHex ? hexDraft : hex}
            spellCheck={false}
            onChange={(e) => {
              setEditingHex(true);
              setHexDraft(e.target.value);
            }}
            onBlur={commitHex}
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
            className={fieldClass}
          />
        </Row>

        <Row label="RGB" copy={() => onCopy(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`)}>
          {["r", "g", "b"].map((ch) => (
            <input
              key={ch}
              type="number"
              min={0}
              max={255}
              value={rgb[ch]}
              onChange={(e) => onRgbChange({ ...rgb, [ch]: clampInt(e.target.value, 0, 255) })}
              className={fieldClass}
            />
          ))}
        </Row>

        <Row label="HSL" copy={() => onCopy(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`)}>
          <input type="number" min={0} max={360} value={hsl.h}
            onChange={(e) => onHslChange({ ...hsl, h: clampInt(e.target.value, 0, 360) })} className={fieldClass} />
          <input type="number" min={0} max={100} value={hsl.s}
            onChange={(e) => onHslChange({ ...hsl, s: clampInt(e.target.value, 0, 100) })} className={fieldClass} />
          <input type="number" min={0} max={100} value={hsl.l}
            onChange={(e) => onHslChange({ ...hsl, l: clampInt(e.target.value, 0, 100) })} className={fieldClass} />
        </Row>

        <Row label="HSV" copy={() => onCopy(`hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`)}>
          <input type="number" min={0} max={360} value={hsv.h}
            onChange={(e) => onHsvChange({ ...hsv, h: clampInt(e.target.value, 0, 360) })} className={fieldClass} />
          <input type="number" min={0} max={100} value={hsv.s}
            onChange={(e) => onHsvChange({ ...hsv, s: clampInt(e.target.value, 0, 100) })} className={fieldClass} />
          <input type="number" min={0} max={100} value={hsv.v}
            onChange={(e) => onHsvChange({ ...hsv, v: clampInt(e.target.value, 0, 100) })} className={fieldClass} />
        </Row>

        <Row label="CMYK" copy={() => onCopy(`cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`)}>
          {["c", "m", "y", "k"].map((ch) => (
            <input
              key={ch}
              type="number"
              min={0}
              max={100}
              value={cmyk[ch]}
              onChange={(e) => onCmykChange({ ...cmyk, [ch]: clampInt(e.target.value, 0, 100) })}
              className={fieldClass}
            />
          ))}
        </Row>
      </div>
    </div>
  );
}

function Row({ label, copy, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 flex-shrink-0 text-[11px] text-muted uppercase tracking-wide">{label}</span>
      <div className="flex-1 min-w-0 flex gap-1.5">{children}</div>
      <button onClick={copy} className={copyBtnClass}>Copy</button>
    </div>
  );
}

function clampInt(val, min, max) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}
