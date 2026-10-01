"use client";

import { useMemo, useRef, useState } from "react";
import { downloadBlob } from "@/lib/zip";
import { buildPoeExport, parsePoeImport, summarizePoeData } from "@/lib/poe";

const fieldClass =
  "w-full bg-bg border border-border text-text px-2.5 py-2 rounded-lg text-[12px] font-mono min-h-[150px] resize-y";

const ghostBtn =
  "flex-shrink-0 bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px]";

/** Clipboard API needs a secure context; bare http falls back to execCommand. */
async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      /* fall through */
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-1000px";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (e) {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export default function SystemPanel({
  ready,
  tradeConfigs,
  makerGroups,
  exchangeCosts,
  duoGroups,
  tripleGroups,
  poeLeague,
  onReplace,
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);

  // Derived, so the export always mirrors what's stored right now.
  const exported = useMemo(
    () => buildPoeExport({ tradeConfigs, makerGroups, exchangeCosts, duoGroups, tripleGroups, poeLeague }),
    [tradeConfigs, makerGroups, exchangeCosts, duoGroups, tripleGroups, poeLeague]
  );
  const exportedText = useMemo(() => JSON.stringify(exported, null, 2), [exported]);

  // Parsed as you type so the reason the Replace button is disabled is on
  // screen — the button can't be clicked to reveal the error.
  const { data: preview, error: parseError } = useMemo(() => {
    if (!text.trim()) return { data: null, error: "" };
    try {
      return { data: parsePoeImport(text), error: "" };
    } catch (e) {
      return { data: null, error: e.message };
    }
  }, [text]);

  function download() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([exportedText], { type: "application/json" }), `poe-tools-${stamp}.json`);
  }

  async function copyExport() {
    if (await copyText(exportedText)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  async function loadFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setNote("");
    try {
      setText(await file.text());
      setError("");
    } catch (err) {
      setError(`Could not read ${file.name} — ${err.message}`);
    }
  }

  function apply() {
    if (!preview) return;
    const count = onReplace(preview);
    setError("");
    setText("");
    // A collection the file predates arrives as null and is left as it is, so
    // the note says "kept" rather than reporting a count of nothing.
    const part = (list, kept, counted) =>
      list === null ? kept : `${list.length} ${counted}`;

    setNote(
      [
        `Imported ${count} config${count === 1 ? "" : "s"}`,
        part(preview.makerGroups, "Maker groups kept", "Maker groups"),
        part(preview.exchangeCosts, "exchange costs kept", "exchange items"),
        part(preview.duoGroups, "Duo groups kept", "Duo groups"),
        part(preview.tripleGroups, "Triple groups kept", "Triple groups"),
        preview.poeLeague,
      ].join(" · ")
    );
  }

  return (
    <>
      <div className="text-[12.5px] text-muted mb-3">
        Back up or restore the POE Tools data —{" "}
        {summarizePoeData({ tradeConfigs, makerGroups, exchangeCosts, duoGroups, tripleGroups, poeLeague })}.
      </div>

      <div className="bg-bg border border-border rounded-lg px-2.5 pt-2 pb-2.5">
        <div className="flex items-center gap-2 flex-wrap pb-2 mb-2.5 border-b border-border">
          <span className="text-[11px] uppercase tracking-wide text-muted font-semibold">Export</span>
          <span className="flex-1 min-w-0" />
          <button onClick={copyExport} className={ghostBtn}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button onClick={download} className={ghostBtn}>
            Download .json
          </button>
        </div>
        <pre className="bg-panel2 border border-border rounded-lg p-2.5 text-[11.5px] font-mono text-muted whitespace-pre-wrap break-all max-h-[260px] overflow-y-auto">
          {ready ? exportedText : "Loading…"}
        </pre>
      </div>

      <div className="bg-bg border border-border rounded-lg px-2.5 pt-2 pb-2.5 mt-2.5">
        <div className="flex items-center gap-2 flex-wrap pb-2 mb-2.5 border-b border-border">
          <span className="text-[11px] uppercase tracking-wide text-muted font-semibold">Import</span>
          <span className="flex-1 min-w-0" />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={loadFile}
            className="hidden"
          />
          <button onClick={() => fileRef.current?.click()} className={ghostBtn}>
            Load file…
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
            setNote("");
          }}
          placeholder="Paste an exported JSON here, or load the file above."
          spellCheck={false}
          className={fieldClass}
        />

        <div className="flex items-center justify-between gap-3 flex-wrap mt-2.5">
          <div className="text-[11.5px] text-muted">
            {error || parseError ? (
              <span className="text-red-400">{error || parseError}</span>
            ) : note ? (
              <span className="text-accent2">{note}</span>
            ) : preview ? (
              <>Replaces all POE data with {summarizePoeData(preview)}.</>
            ) : (
              "Replaces every saved config, the Exchange lists and the selected league. Notes and links are untouched."
            )}
          </div>
          <button
            onClick={apply}
            disabled={!preview}
            className="flex-shrink-0 bg-accent text-white px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-40"
          >
            Replace POE data
          </button>
        </div>
      </div>
    </>
  );
}
