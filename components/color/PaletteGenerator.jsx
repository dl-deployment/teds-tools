"use client";

import { useMemo } from "react";
import {
  complementary, analogous, triadic, tetradic,
  splitComplementary, monochromatic, hslToRgb,
} from "@/lib/color";
import ColorSwatch from "./ColorSwatch";

const PALETTE_TYPES = [
  { id: "complementary", label: "Complementary", fn: complementary },
  { id: "analogous", label: "Analogous", fn: analogous },
  { id: "triadic", label: "Triadic", fn: triadic },
  { id: "tetradic", label: "Tetradic", fn: tetradic },
  { id: "split", label: "Split Complementary", fn: splitComplementary },
  { id: "mono", label: "Monochromatic", fn: monochromatic },
];

export default function PaletteGenerator({ hsl, rgb, onSelectColor, onCopy }) {
  const palettes = useMemo(
    () => PALETTE_TYPES.map((type) => ({ ...type, colors: type.fn(hsl).map(hslToRgb) })),
    [hsl.h, hsl.s, hsl.l]
  );

  return (
    <div className="flex flex-col gap-4">
      {palettes.map((palette) => (
        <div key={palette.id}>
          <div className="text-[12.5px] text-muted mb-2">{palette.label}</div>
          <div className="flex gap-1.5">
            <ColorSwatch rgb={rgb} onCopy={onCopy} />
            {palette.colors.map((color, i) => (
              <ColorSwatch key={i} rgb={color} onClick={onSelectColor} onCopy={onCopy} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
