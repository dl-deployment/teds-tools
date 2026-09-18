"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createZip, downloadBlob } from "@/lib/zip";
import { atlasUsage, buildCocosPlist, nextPow2, shelfPack } from "@/lib/spritesheet";
import { DropZone, FrameOverlay, Section, Toast, useToast } from "./Shared";

const numInputClass = "w-24 bg-bg border border-border text-text px-2 py-1 rounded-lg text-[12.5px]";
const ghostBtnClass =
  "bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px]";
const runBtnClass =
  "bg-accent2 text-bg px-3.5 py-2 rounded-lg text-[12.5px] font-semibold hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100";

const WIDTH_PRESETS = [512, 1024, 2048, 4096];

function renderAtlas(frames, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  for (const f of frames) ctx.drawImage(f.img, f.x, f.y, f.w, f.h);
  return canvas;
}

export default function TexturePacker() {
  const { toast, show } = useToast();
  const [assets, setAssets] = useState([]);
  const [padding, setPadding] = useState(2);
  const [maxWidth, setMaxWidth] = useState(2048);
  const [pot, setPot] = useState(false);
  const [result, setResult] = useState(null);
  const [isPacking, setIsPacking] = useState(false);
  const nextId = useRef(1);

  const urlsRef = useRef({ assets: [], result: null });
  useEffect(() => {
    urlsRef.current.assets = assets;
  }, [assets]);
  useEffect(() => {
    urlsRef.current.result = result;
  }, [result]);
  useEffect(
    () => () => {
      urlsRef.current.assets.forEach((a) => URL.revokeObjectURL(a.url));
      if (urlsRef.current.result?.url) URL.revokeObjectURL(urlsRef.current.result.url);
    },
    []
  );

  const totalPixels = useMemo(
    () => assets.reduce((sum, a) => sum + a.w * a.h, 0),
    [assets]
  );

  function resetResult() {
    setResult((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }

  function addFiles(files) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length) {
      show("No image files found", "error");
      return;
    }

    const loaded = [];
    let pending = imageFiles.length;

    const settle = () => {
      if (--pending === 0) {
        setAssets((prev) => [...prev, ...loaded]);
        resetResult();
      }
    };

    for (const file of imageFiles) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        loaded.push({
          id: nextId.current++,
          name: file.name.replace(/\.[^/.]+$/, ""),
          img,
          w: img.naturalWidth,
          h: img.naturalHeight,
          url,
        });
        settle();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        settle();
      };
      img.src = url;
    }
  }

  function removeAsset(id) {
    setAssets((prev) => {
      const item = prev.find((a) => a.id === id);
      if (item) URL.revokeObjectURL(item.url);
      const next = prev.filter((a) => a.id !== id);
      if (next.length === 0) resetResult();
      return next;
    });
  }

  function clearAll() {
    setAssets((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.url));
      return [];
    });
    resetResult();
  }

  function handlePack() {
    if (!assets.length) return;
    setIsPacking(true);
    try {
      const frames = assets.map((a) => ({ name: `${a.name}.png`, img: a.img, w: a.w, h: a.h }));
      const { packed, width, height } = shelfPack(frames, padding, pot ? nextPow2(maxWidth) : maxWidth);
      const finalW = pot ? nextPow2(width) : width;
      const finalH = pot ? nextPow2(height) : height;

      const canvas = renderAtlas(packed, finalW, finalH);
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        setResult((prev) => {
          if (prev?.url) URL.revokeObjectURL(prev.url);
          return { blob, url, frames: packed, w: finalW, h: finalH };
        });
        show(
          `Packed ${packed.length} images — ${finalW}×${finalH} (${atlasUsage(packed, finalW, finalH)}% used)`
        );
        setIsPacking(false);
      }, "image/png");
    } catch (err) {
      show(err.message || "Packing failed", "error");
      setIsPacking(false);
    }
  }

  async function handleDownload() {
    if (!result) return;
    try {
      const plist = buildCocosPlist({
        frames: result.frames,
        width: result.w,
        height: result.h,
      });
      const zip = await createZip([
        { name: "spritesheet.plist", data: plist },
        { name: "spritesheet.png", data: result.blob },
      ]);
      downloadBlob(zip, "texturepack_output.zip");
      show("Downloaded texturepack_output.zip");
    } catch (err) {
      show(err.message || "Download failed", "error");
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      {assets.length === 0 ? (
        <DropZone onFiles={addFiles} accept="image/*" multiple icon="📦">
          <div className="text-[13px] font-medium">Drop images here</div>
          <div className="text-[12px] text-muted">or click to browse · PNG, JPG, WebP</div>
        </DropZone>
      ) : (
        <>
          <Section
            title={`Assets (${assets.length}) · ${totalPixels.toLocaleString()} px`}
            actions={
              <div className="flex gap-2">
                <label className={ghostBtnClass}>
                  + Add
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button onClick={clearAll} className={ghostBtnClass}>Clear</button>
              </div>
            }
          >
            <div className="flex flex-col">
              {assets.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 py-1.5 border-b border-border last:border-none"
                >
                  <span className="w-8 h-8 flex-shrink-0 rounded-md border border-border bg-bg flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt="" className="max-w-full max-h-full" />
                  </span>
                  <span className="flex-1 min-w-0 truncate text-[12.5px]" title={a.name}>
                    {a.name}
                  </span>
                  <span className="text-[11px] text-muted flex-shrink-0">
                    {a.w}×{a.h}
                  </span>
                  <button
                    onClick={() => removeAsset(a.id)}
                    title="Remove"
                    className="flex-shrink-0 text-muted hover:text-red-400 text-[13px] leading-none px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Settings"
            actions={
              <button onClick={handlePack} disabled={isPacking} className={runBtnClass}>
                {isPacking ? "Packing…" : "Pack"}
              </button>
            }
          >
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1.5 text-[12.5px] text-muted">
                Padding
                <input
                  type="number"
                  min={0}
                  max={64}
                  value={padding}
                  onChange={(e) => {
                    setPadding(Math.max(0, +e.target.value));
                    resetResult();
                  }}
                  className={numInputClass}
                />
              </label>
              <div className="flex flex-col gap-1.5 text-[12.5px] text-muted">
                Max width
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={64}
                    max={4096}
                    step={64}
                    value={maxWidth}
                    onChange={(e) => {
                      setMaxWidth(Math.max(64, +e.target.value));
                      resetResult();
                    }}
                    className={numInputClass}
                  />
                  <div className="flex gap-1">
                    {WIDTH_PRESETS.map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          setMaxWidth(v);
                          resetResult();
                        }}
                        className={`px-2 py-1 rounded-md text-[11px] border ${
                          maxWidth === v
                            ? "bg-accent2/[0.16] border-accent2/40 text-text"
                            : "bg-transparent border-border text-muted hover:text-text"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-[12.5px] text-muted pb-1.5">
                <input
                  type="checkbox"
                  checked={pot}
                  onChange={(e) => {
                    setPot(e.target.checked);
                    resetResult();
                  }}
                  className="accent-accent2"
                />
                Power of 2
              </label>
            </div>
          </Section>

          {result && (
            <Section
              title={`Result — ${result.w}×${result.h}px, ${result.frames.length} frames`}
              actions={
                <button onClick={handleDownload} className={runBtnClass}>
                  Download ZIP
                </button>
              }
            >
              <div className="flex justify-center bg-bg border border-border rounded-lg p-3 overflow-auto">
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.url}
                    alt="Packed sprite sheet"
                    draggable={false}
                    className="block max-w-full max-h-[420px]"
                  />
                  <FrameOverlay
                    rects={result.frames.map((f) => ({
                      x: f.x,
                      y: f.y,
                      w: f.w,
                      h: f.h,
                      label: f.name.replace(/\.png$/, ""),
                    }))}
                    totalW={result.w}
                    totalH={result.h}
                    showLabels
                  />
                </div>
              </div>
            </Section>
          )}
        </>
      )}

      <Toast toast={toast} />
    </div>
  );
}
