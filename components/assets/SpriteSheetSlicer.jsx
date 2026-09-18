"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createZip, downloadBlob } from "@/lib/zip";
import { parsePlist, plistFrames } from "@/lib/spritesheet";
import { DropZone, FrameOverlay, Section, Toast, useToast } from "./Shared";

const numInputClass =
  "w-16 bg-bg border border-border text-text px-2 py-1 rounded-lg text-[12.5px] text-center";
const ghostBtnClass =
  "bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px]";
const runBtnClass =
  "bg-accent2 text-bg px-3.5 py-2 rounded-lg text-[12.5px] font-semibold hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100";

const canvasToBlob = (canvas) => new Promise((r) => canvas.toBlob(r, "image/png"));

/**
 * Cut a frame out of the atlas. `displayFrame` is the real texture rect (its
 * w/h are swapped for frames stored rotated), then it is un-rotated 90° CW
 * and, if asked, composited back onto its untrimmed `sourceSize` canvas.
 */
function extractFrame(texture, f, restoreTrim) {
  const { displayFrame, rotated, sourceSize, sourceColorRect } = f;

  const cut = document.createElement("canvas");
  cut.width = displayFrame.w;
  cut.height = displayFrame.h;
  cut
    .getContext("2d")
    .drawImage(
      texture,
      displayFrame.x,
      displayFrame.y,
      displayFrame.w,
      displayFrame.h,
      0,
      0,
      displayFrame.w,
      displayFrame.h
    );

  let content = cut;
  if (rotated) {
    content = document.createElement("canvas");
    content.width = displayFrame.h;
    content.height = displayFrame.w;
    const ctx = content.getContext("2d");
    ctx.translate(content.width / 2, content.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(cut, -cut.width / 2, -cut.height / 2);
  }

  if (restoreTrim && sourceSize) {
    const out = document.createElement("canvas");
    out.width = sourceSize.w;
    out.height = sourceSize.h;
    out.getContext("2d").drawImage(content, sourceColorRect.x, sourceColorRect.y);
    return out;
  }
  return content;
}

export default function SpriteSheetSlicer() {
  const { toast, show } = useToast();
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState("grid");

  const [cols, setCols] = useState(2);
  const [rows, setRows] = useState(2);
  const [inputCols, setInputCols] = useState("2");
  const [inputRows, setInputRows] = useState("2");
  const [inputW, setInputW] = useState("");
  const [inputH, setInputH] = useState("");

  const [plistData, setPlistData] = useState(null);
  const [plistFileName, setPlistFileName] = useState("");
  const [restoreTrim, setRestoreTrim] = useState(true);
  const [isSlicing, setIsSlicing] = useState(false);
  const plistInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const frames = useMemo(() => plistFrames(plistData), [plistData]);

  function loadPlist(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = parsePlist(e.target.result);
      if (!data || !data.frames) {
        show("Invalid plist — no frames found", "error");
        return;
      }
      setPlistData(data);
      setPlistFileName(file.name);
      setMode("plist");
      const count = Object.keys(data.frames).length;
      show(`Loaded ${count} frame${count > 1 ? "s" : ""} from plist`);
    };
    reader.onerror = () => show("Failed to read plist file", "error");
    reader.readAsText(file);
  }

  function loadImage(file) {
    if (!file) return;
    if (file.name.endsWith(".plist")) {
      loadPlist(file);
      return;
    }
    if (!file.type.startsWith("image/")) {
      show("Please drop an image or .plist file", "error");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setImageUrl(url);
      setFileName(file.name.replace(/\.[^/.]+$/, ""));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      show("Failed to load image", "error");
    };
    img.src = url;
  }

  function clampCount(raw) {
    return Math.max(1, Math.min(100, parseInt(raw, 10) || 1));
  }

  function commitCount(raw, setValue, setInput) {
    const val = clampCount(raw);
    setValue(val);
    setInput(String(val));
  }

  function loadPlistFile(files) {
    const file = files[0];
    if (file?.name.endsWith(".plist")) loadPlist(file);
    else show("Please drop a .plist file", "error");
  }

  function handleReset() {
    setImage(null);
    setImageUrl(null);
    setFileName("");
    setCols(2);
    setRows(2);
    setInputCols("2");
    setInputRows("2");
    setInputW("");
    setInputH("");
    setPlistData(null);
    setPlistFileName("");
    setMode("grid");
  }

  function applyWidth() {
    if (!image) return;
    const w = Math.max(1, parseInt(inputW, 10) || 1);
    const next = Math.max(1, Math.min(100, Math.floor(image.naturalWidth / w)));
    setCols(next);
    setInputCols(String(next));
    setInputW("");
  }

  function applyHeight() {
    if (!image) return;
    const h = Math.max(1, parseInt(inputH, 10) || 1);
    const next = Math.max(1, Math.min(100, Math.floor(image.naturalHeight / h)));
    setRows(next);
    setInputRows(String(next));
    setInputH("");
  }

  async function handleSlice() {
    if (!image) return;
    setIsSlicing(true);
    try {
      const entries = [];

      if (mode === "plist" && frames.length > 0) {
        for (const f of frames) {
          const canvas = extractFrame(image, f, restoreTrim);
          entries.push({ name: f.rawName, data: await canvasToBlob(canvas) });
        }
        show(`Extracted ${frames.length} frame${frames.length > 1 ? "s" : ""}`);
      } else {
        const cellW = Math.floor(image.naturalWidth / cols);
        const cellH = Math.floor(image.naturalHeight / rows);
        const canvas = document.createElement("canvas");
        canvas.width = cellW;
        canvas.height = cellH;
        const ctx = canvas.getContext("2d");
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            ctx.clearRect(0, 0, cellW, cellH);
            ctx.drawImage(image, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
            entries.push({ name: `${fileName}_r${r}_c${c}.png`, data: await canvasToBlob(canvas) });
          }
        }
        show(`Sliced into ${cols * rows} piece${cols * rows > 1 ? "s" : ""}`);
      }

      const zip = await createZip(entries);
      downloadBlob(zip, `${fileName}_${mode === "plist" ? "plist" : `${cols}x${rows}`}.zip`);
    } catch (err) {
      show(err.message || "Slicing failed", "error");
    } finally {
      setIsSlicing(false);
    }
  }

  const cellW = image ? Math.floor(image.naturalWidth / cols) : 0;
  const cellH = image ? Math.floor(image.naturalHeight / rows) : 0;
  const canSlice = image && (mode !== "plist" || plistData);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex justify-between items-center gap-3">
        <div className="flex gap-1.5">
          {[
            { id: "grid", label: "Grid" },
            { id: "plist", label: "Plist (Cocos)" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] border ${
                mode === m.id
                  ? "bg-accent2/[0.16] border-accent2/40 text-text"
                  : "bg-transparent border-border text-muted hover:text-text"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {image && (
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[12.5px] text-muted truncate">{fileName}</span>
            <button onClick={handleReset} className={ghostBtnClass}>Reset</button>
          </div>
        )}
      </div>

      {!image ? (
        <DropZone
          onFiles={(files) => loadImage(files[0])}
          accept={mode === "plist" ? ".plist,image/*" : "image/*"}
          icon="🖼"
        >
          <div className="text-[13px] text-muted">
            Drop a spritesheet image{mode === "plist" ? " or .plist file" : ""} here or{" "}
            <span className="text-accent2">browse</span>
          </div>
        </DropZone>
      ) : (
        <>
          <Section
            title="Slice settings"
            actions={
              <span className="text-[11px] text-muted">
                {image.naturalWidth}×{image.naturalHeight}px
              </span>
            }
          >
            {mode === "grid" ? (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-[12.5px] text-muted">
                  Cols
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={inputCols}
                    onChange={(e) => setInputCols(e.target.value)}
                    onBlur={() => commitCount(inputCols, setCols, setInputCols)}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    className={numInputClass}
                  />
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-muted">
                  Rows
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={inputRows}
                    onChange={(e) => setInputRows(e.target.value)}
                    onBlur={() => commitCount(inputRows, setRows, setInputRows)}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    className={numInputClass}
                  />
                </label>
                <span className="text-muted">/</span>
                <label className="flex items-center gap-2 text-[12.5px] text-muted">
                  W
                  <input
                    type="number"
                    min={1}
                    placeholder={String(cellW)}
                    value={inputW}
                    onChange={(e) => setInputW(e.target.value)}
                    onBlur={applyWidth}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    className={numInputClass}
                  />
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-muted">
                  H
                  <input
                    type="number"
                    min={1}
                    placeholder={String(cellH)}
                    value={inputH}
                    onChange={(e) => setInputH(e.target.value)}
                    onBlur={applyHeight}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    className={numInputClass}
                  />
                </label>
                <span className="text-[12.5px] text-muted">
                  {cols * rows} pieces · {cellW}×{cellH}px each
                </span>
              </div>
            ) : !plistData ? (
              <DropZone onFiles={loadPlistFile} accept=".plist" className="py-6">
                <div className="text-[13px] text-muted">
                  Drop a Cocos <strong className="text-text">.plist</strong> file here or{" "}
                  <span className="text-accent2">browse</span>
                </div>
              </DropZone>
            ) : (
              <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
                <span className="text-muted truncate">{plistFileName}</span>
                <span className="px-2 py-0.5 rounded-full bg-panel text-muted text-[11px]">
                  {frames.length} frames
                </span>
                <label className="flex items-center gap-2 text-muted">
                  <input
                    type="checkbox"
                    checked={restoreTrim}
                    onChange={(e) => setRestoreTrim(e.target.checked)}
                    className="accent-accent2"
                  />
                  Restore trim
                </label>
                <input
                  ref={plistInputRef}
                  type="file"
                  accept=".plist"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files[0]) loadPlist(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
                <button onClick={() => plistInputRef.current?.click()} className={ghostBtnClass}>
                  Change
                </button>
              </div>
            )}

            <div className="flex justify-end mt-3">
              <button onClick={handleSlice} disabled={isSlicing || !canSlice} className={runBtnClass}>
                {isSlicing ? "Slicing…" : "Slice & download ZIP"}
              </button>
            </div>
          </Section>

          <Section title="Preview">
            <div className="flex justify-center bg-bg border border-border rounded-lg p-3 overflow-auto">
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Sprite sheet preview"
                  draggable={false}
                  className="block max-w-full max-h-[420px]"
                />
                {mode === "grid" ? (
                  <div
                    className="absolute inset-0 grid"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, 1fr)`,
                      gridTemplateRows: `repeat(${rows}, 1fr)`,
                    }}
                  >
                    {Array.from({ length: cols * rows }, (_, i) => (
                      <div key={i} className="border border-white/30" />
                    ))}
                  </div>
                ) : (
                  frames.length > 0 && (
                    <FrameOverlay
                      rects={frames.map((f) => ({ ...f.displayFrame, label: f.rawName }))}
                      totalW={image.naturalWidth}
                      totalH={image.naturalHeight}
                    />
                  )
                )}
              </div>
            </div>
          </Section>
        </>
      )}

      <Toast toast={toast} />
    </div>
  );
}
