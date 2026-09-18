"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DropZone, Section, Toast, useToast } from "./Shared";

const LOOP_MODES = [
  { id: "loop", label: "Loop" },
  { id: "ping-pong", label: "Ping Pong" },
  { id: "no-loop", label: "No Loop" },
];

const ghostBtnClass =
  "bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px]";
const runBtnClass =
  "bg-accent2 text-bg px-3.5 py-2 rounded-lg text-[12.5px] font-semibold hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100";

export default function SpritesheetViewer() {
  const { toast, show } = useToast();
  const [frames, setFrames] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fps, setFps] = useState(12);
  const [loopMode, setLoopMode] = useState("loop");
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const animRef = useRef(null);
  const indexRef = useRef(0);
  const dirRef = useRef(1);
  const fpsRef = useRef(12);
  const loopRef = useRef("loop");
  const currentIndexRef = useRef(0);
  const framesRef = useRef([]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  const stopAnimation = useCallback(() => {
    if (animRef.current) {
      clearInterval(animRef.current);
      animRef.current = null;
    }
  }, []);

  const startAnimation = useCallback(() => {
    stopAnimation();
    animRef.current = setInterval(() => {
      const len = framesRef.current.length;
      if (len === 0) return;
      const mode = loopRef.current;

      if (mode === "no-loop") {
        if (indexRef.current >= len - 1) {
          stopAnimation();
          setIsPlaying(false);
          return;
        }
        indexRef.current += 1;
      } else if (mode === "ping-pong") {
        indexRef.current += dirRef.current;
        if (indexRef.current >= len - 1 || indexRef.current <= 0) dirRef.current *= -1;
      } else {
        indexRef.current = (indexRef.current + 1) % len;
      }
      setCurrentIndex(indexRef.current);
    }, 1000 / fpsRef.current);
  }, [stopAnimation]);

  // One effect owns playback: it (re)starts whenever play state, frame count
  // or speed changes, always resuming from the frame on screen.
  useEffect(() => {
    fpsRef.current = fps;
    loopRef.current = loopMode;
    if (!isPlaying || frames.length < 2) return;
    indexRef.current = currentIndexRef.current;
    dirRef.current =
      loopMode === "ping-pong" && indexRef.current >= frames.length - 1 ? -1 : 1;
    startAnimation();
    return stopAnimation;
  }, [isPlaying, frames.length, fps, loopMode, startAnimation, stopAnimation]);

  useEffect(
    () => () => {
      stopAnimation();
      framesRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [stopAnimation]
  );

  function loadFiles(files) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length) {
      show("No image files found", "error");
      return;
    }
    stopAnimation();
    const urls = imageFiles.map((f) => URL.createObjectURL(f));
    setFrames((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      return urls;
    });
    setCurrentIndex(0);
    indexRef.current = 0;
    dirRef.current = 1;
    setIsPlaying(true);
  }

  function selectFrame(index) {
    stopAnimation();
    setIsPlaying(false);
    setCurrentIndex(index);
    indexRef.current = index;
  }

  function handleStop() {
    stopAnimation();
    setIsPlaying(false);
    setCurrentIndex(0);
    indexRef.current = 0;
    dirRef.current = 1;
  }

  function chooseLoop(mode) {
    setLoopMode(mode);
    if (mode !== "no-loop" && !isPlaying && frames.length > 1) setIsPlaying(true);
  }

  const hasFrames = frames.length > 0;

  return (
    <div className="flex flex-col gap-3.5">
      {!hasFrames ? (
        <DropZone onFiles={loadFiles} accept="image/*" multiple className="py-14">
          <div className="text-[24px] leading-none text-muted">⤓</div>
          <div className="text-[13px]">Drop image files here to preview animation</div>
          <div className="text-[12px] text-muted">Supports PNG, GIF, JPG, WebP</div>
        </DropZone>
      ) : (
        <>
          <Section title="Preview" actions={<span className="text-[11px] text-muted">{currentIndex + 1} / {frames.length}</span>}>
            <div
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
                loadFiles(e.dataTransfer.files);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget)) return;
                setDragOver(false);
              }}
              className={`relative flex items-center justify-center bg-bg border rounded-lg p-3 min-h-[240px] ${
                dragOver ? "border-accent" : "border-border"
              }`}
            >
              {dragOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-accent/10 text-[12.5px] text-text rounded-lg">
                  Drop to replace frames
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={frames[currentIndex]}
                alt={`Frame ${currentIndex + 1}`}
                className="max-w-full max-h-[360px] [image-rendering:pixelated]"
              />
            </div>

            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
              {frames.map((url, i) => (
                <button
                  key={i}
                  onClick={() => selectFrame(i)}
                  title={`Frame ${i + 1}`}
                  className={`flex-shrink-0 w-12 h-12 rounded-md border bg-bg flex items-center justify-center overflow-hidden ${
                    i === currentIndex
                      ? `border-accent2 ${isPlaying ? "ring-1 ring-accent2" : ""}`
                      : "border-border hover:border-accent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="max-w-full max-h-full [image-rendering:pixelated]" />
                </button>
              ))}
            </div>
          </Section>

          <Section
            title="Playback"
            actions={
              <div className="flex gap-2">
                <button
                  onClick={() => (isPlaying ? (stopAnimation(), setIsPlaying(false)) : setIsPlaying(true))}
                  disabled={frames.length < 2}
                  className={runBtnClass}
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button onClick={handleStop} className={ghostBtnClass}>Stop</button>
              </div>
            }
          >
            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-3 text-[12.5px] text-muted">
                FPS: <strong className="text-text w-6 text-right">{fps}</strong>
                <input
                  type="range"
                  min={1}
                  max={60}
                  step={1}
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="w-48 accent-accent2"
                />
              </label>
              <div className="flex items-center gap-2 text-[12.5px] text-muted">
                Loop
                <div className="flex gap-1.5">
                  {LOOP_MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => chooseLoop(m.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[12.5px] border ${
                        loopMode === m.id
                          ? "bg-accent2/[0.16] border-accent2/40 text-text"
                          : "bg-transparent border-border text-muted hover:text-text"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        </>
      )}

      <Toast toast={toast} />
    </div>
  );
}
