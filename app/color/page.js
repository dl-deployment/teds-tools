"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { SubSidebar, SubItem, ContentPane } from "@/components/SubSidebar";
import ColorInput from "@/components/color/ColorInput";
import PaletteGenerator from "@/components/color/PaletteGenerator";
import ContrastChecker from "@/components/color/ContrastChecker";
import ShadesAndTints from "@/components/color/ShadesAndTints";
import GradientGenerator from "@/components/color/GradientGenerator";
import {
  rgbToHex, rgbToHsl, rgbToHsv, rgbToCmyk,
  hexToRgb, hslToRgb, hsvToRgb, cmykToRgb, isValidHex,
  randomRgb, nearestColorName,
} from "@/lib/color";
import { useHubData } from "@/lib/useHubData";

const TABS = [
  { id: "picker", label: "Picker", desc: "Convert between formats", icon: "◉" },
  { id: "palette", label: "Palette", desc: "Harmony palettes", icon: "◑" },
  { id: "contrast", label: "Contrast", desc: "WCAG contrast ratio", icon: "◐" },
  { id: "shades", label: "Shades", desc: "Shades and tints", icon: "▤" },
  { id: "gradient", label: "Gradient", desc: "Build a CSS gradient", icon: "▥" },
];

const ghostBtnClass =
  "bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px]";

export default function ColorPage() {
  const { colorHistory, addColorToHistory } = useHubData();
  const [rgb, setRgb] = useState({ r: 99, g: 102, b: 241 });
  const [activeTab, setActiveTab] = useState("picker");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const hex = useMemo(() => rgbToHex(rgb), [rgb.r, rgb.g, rgb.b]);
  const hsl = useMemo(() => rgbToHsl(rgb), [rgb.r, rgb.g, rgb.b]);
  const hsv = useMemo(() => rgbToHsv(rgb), [rgb.r, rgb.g, rgb.b]);
  const cmyk = useMemo(() => rgbToCmyk(rgb), [rgb.r, rgb.g, rgb.b]);
  const colorName = useMemo(() => nearestColorName(rgb), [rgb.r, rgb.g, rgb.b]);

  const active = TABS.find((t) => t.id === activeTab) || TABS[0];

  const showToast = useCallback((message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  }, []);

  const copyToClipboard = useCallback(
    (text) => {
      navigator.clipboard.writeText(text).then(
        () => showToast(`Copied ${text}`),
        () => showToast("Copy failed")
      );
    },
    [showToast]
  );

  const apply = useCallback(
    (next) => {
      setRgb(next);
      addColorToHistory(next);
    },
    [addColorToHistory]
  );

  const onHexChange = useCallback(
    (val) => {
      const clean = val.startsWith("#") ? val : "#" + val;
      if (isValidHex(clean)) apply(hexToRgb(clean));
    },
    [apply]
  );

  const onSelectColor = useCallback(
    (next) => {
      apply(next);
      setActiveTab("picker");
    },
    [apply]
  );

  return (
    <>
      <SubSidebar title="Color Tools">
        {TABS.map((tab) => (
          <SubItem
            key={tab.id}
            active={tab.id === active.id}
            onClick={() => setActiveTab(tab.id)}
            label={tab.label}
            sub={tab.desc}
            icon={
              <span className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5 bg-accent4/20 text-accent4">
                {tab.icon}
              </span>
            }
          />
        ))}
      </SubSidebar>

      <ContentPane>
        <div className="bg-panel border border-border rounded-card px-4.5 pt-4.5 pb-4.5">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
            <div className="flex items-baseline gap-2.5">
              <div className="text-[15px] font-semibold">{active.label}</div>
              <div className="text-[12.5px] text-muted">{colorName}</div>
            </div>
            <button onClick={() => apply(randomRgb())} className={ghostBtnClass}>
              Random
            </button>
          </div>

          {colorHistory.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {colorHistory.map((h) => (
                <button
                  key={h.hex}
                  onClick={() => setRgb(h.rgb)}
                  title={h.hex}
                  className="w-6 h-6 rounded-md border border-border"
                  style={{ backgroundColor: h.hex }}
                />
              ))}
            </div>
          )}

          {activeTab === "picker" && (
            <ColorInput
              rgb={rgb}
              hex={hex}
              hsl={hsl}
              hsv={hsv}
              cmyk={cmyk}
              onHexChange={onHexChange}
              onRgbChange={apply}
              onHslChange={(v) => apply(hslToRgb(v))}
              onHsvChange={(v) => apply(hsvToRgb(v))}
              onCmykChange={(v) => apply(cmykToRgb(v))}
              onCopy={copyToClipboard}
            />
          )}

          {activeTab === "palette" && (
            <PaletteGenerator hsl={hsl} rgb={rgb} onSelectColor={onSelectColor} onCopy={copyToClipboard} />
          )}

          {activeTab === "contrast" && <ContrastChecker initialFg={rgb} />}

          {activeTab === "shades" && <ShadesAndTints rgb={rgb} onSelectColor={onSelectColor} />}

          {activeTab === "gradient" && <GradientGenerator rgb={rgb} onCopy={copyToClipboard} />}
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 z-20 px-3.5 py-2 rounded-lg text-[12.5px] bg-panel2 border border-border text-text">
            {toast}
          </div>
        )}
      </ContentPane>
    </>
  );
}
