"use client";

import { rgbToHex, textColorForBg } from "@/lib/color";

export default function ColorSwatch({ rgb, onClick, onCopy, size = "md" }) {
  const hex = rgbToHex(rgb);
  const textColor = textColorForBg(rgb);

  return (
    <div
      className={`group relative flex-1 min-w-0 ${size === "sm" ? "h-10" : "h-16"} rounded-lg border border-border flex items-center justify-center overflow-hidden ${
        onClick ? "cursor-pointer" : ""
      }`}
      style={{ backgroundColor: hex }}
      title={hex}
      onClick={() => onClick?.(rgb)}
    >
      <span className="text-[10px] font-semibold" style={{ color: textColor }}>
        {hex}
      </span>
      {onCopy && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCopy(hex);
          }}
          className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] opacity-0 group-hover:opacity-100 bg-black/45 text-white"
        >
          Copy
        </button>
      )}
    </div>
  );
}
