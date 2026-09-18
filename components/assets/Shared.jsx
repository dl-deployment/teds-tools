"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Dashed panel that accepts dropped files or opens a file picker on click. */
export function DropZone({ onFiles, accept, multiple = false, icon, children, className = "" }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        // Ignore the leave events fired while moving between child elements.
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setOver(false);
      }}
      onClick={() => inputRef.current?.click()}
      className={`rounded-card border border-dashed cursor-pointer px-6 py-10 flex flex-col items-center justify-center gap-2 text-center ${
        over ? "border-accent bg-accent/[0.06]" : "border-border bg-panel2"
      } ${className}`}
    >
      {icon && <div className="text-[26px] leading-none">{icon}</div>}
      {children}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Colored outlines over a sprite sheet, positioned as a share of the atlas. */
const FRAME_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
  "#F8B500", "#6C5B7B", "#F38181", "#AAE1DB", "#FFC9DE",
];

export function FrameOverlay({ rects, totalW, totalH, showLabels = false }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {rects.map((r, i) => (
        <div
          key={i}
          title={r.label}
          className="absolute border pointer-events-auto hover:z-10 hover:border-2"
          style={{
            left: `${(r.x / totalW) * 100}%`,
            top: `${(r.y / totalH) * 100}%`,
            width: `${(r.w / totalW) * 100}%`,
            height: `${(r.h / totalH) * 100}%`,
            borderColor: FRAME_COLORS[i % FRAME_COLORS.length],
          }}
        >
          {showLabels && (
            <span className="absolute left-0 top-full text-[9px] px-1 rounded-b bg-black/60 text-white whitespace-nowrap">
              {r.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Bordered sub-panel used to group each tool's controls and results. */
export function Section({ title, actions, children }) {
  return (
    <section className="bg-panel2 border border-border rounded-lg p-3.5">
      <div className="flex justify-between items-center gap-3 mb-3">
        <div className="text-[13px] font-semibold">{title}</div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((message, type = "success") => {
    clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, show };
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-20 px-3.5 py-2 rounded-lg text-[12.5px] bg-panel2 border ${
        toast.type === "error" ? "border-red-400/40 text-red-400" : "border-accent2/40 text-accent2"
      }`}
    >
      {toast.message}
    </div>
  );
}
