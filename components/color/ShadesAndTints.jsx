"use client";

import { useMemo } from "react";
import { generateShades, generateTints, rgbToHex, textColorForBg } from "@/lib/color";

export default function ShadesAndTints({ rgb, onSelectColor }) {
  const shades = useMemo(() => generateShades(rgb), [rgb.r, rgb.g, rgb.b]);
  const tints = useMemo(() => generateTints(rgb), [rgb.r, rgb.g, rgb.b]);

  return (
    <div className="flex flex-col gap-4">
      <Strip title="Shades (darker)" colors={shades} onSelectColor={onSelectColor} />
      <Strip title="Tints (lighter)" colors={tints} onSelectColor={onSelectColor} />
    </div>
  );
}

function Strip({ title, colors, onSelectColor }) {
  return (
    <div>
      <div className="text-[12.5px] text-muted mb-2">{title}</div>
      <div className="flex gap-1 min-w-0">
        {colors.map((color, i) => {
          const hex = rgbToHex(color);
          return (
            <div
              key={i}
              onClick={() => onSelectColor?.(color)}
              title={hex}
              className="flex-1 min-w-0 h-14 rounded-md border border-border cursor-pointer flex items-end justify-center pb-1 overflow-hidden"
              style={{ backgroundColor: hex }}
            >
              <span className="text-[9px] font-medium truncate" style={{ color: textColorForBg(color) }}>
                {hex}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
