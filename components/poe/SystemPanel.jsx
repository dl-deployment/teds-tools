"use client";

import { useMemo, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { createZip, downloadBlob } from "@/lib/zip";
import {
  EXTENSION_DIR,
  EXTENSION_FILES,
  EXTENSION_FOLDER,
  buildPoeExport,
  parsePoeImport,
  summarizePoeData,
} from "@/lib/poe";
import { copyText } from "./Snippet";

const fieldClass =
  "w-full bg-bg border border-border text-text px-2.5 py-2 rounded-lg text-[12px] font-mono min-h-[190px] resize-y";

const ghostBtn =
  "flex-shrink-0 bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px]";

const primaryBtn =
  "flex-shrink-0 bg-accent text-white px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-40";

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
  // Which popup is open — null, "export" or "import".
  const [open, setOpen] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [zipNote, setZipNote] = useState("");
  const [zipError, setZipError] = useState("");
  const fileRef = useRef(null);

  const summary = useMemo(
    () => summarizePoeData({ tradeConfigs, makerGroups, exchangeCosts, duoGroups, tripleGroups, poeLeague }),
    [tradeConfigs, makerGroups, exchangeCosts, duoGroups, tripleGroups, poeLeague]
  );

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

  function close() {
    setOpen(null);
    setError("");
    setCopied(false);
  }

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

  // Read from `public/` rather than bundled, so the zip carries exactly the
  // files on disk, and Chrome loads that same folder unpacked.
  async function downloadExtension() {
    setZipping(true);
    setZipNote("");
    setZipError("");
    try {
      const entries = await Promise.all(
        EXTENSION_FILES.map(async (name) => {
          const res = await fetch(`${EXTENSION_DIR}/${name}`);
          if (!res.ok) throw new Error(`${name} — HTTP ${res.status}`);
          return { name: `${EXTENSION_FOLDER}/${name}`, data: await res.text() };
        })
      );
      downloadBlob(await createZip(entries), `${EXTENSION_FOLDER}.zip`);
      setZipNote(`Saved ${EXTENSION_FOLDER}.zip`);
    } catch (e) {
      setZipError(`Could not build the extension zip — ${e.message}`);
    } finally {
      setZipping(false);
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
    setText("");
    setError("");
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
    setOpen(null);
  }

  return (
    <>
      <div className="bg-bg border border-border rounded-lg px-3 py-3">
        <div className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-1.5">
          Export / import
        </div>
        <div className="text-[12.5px] text-muted mb-2.5">
          Back up or restore the POE Tools data — {summary}.
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setOpen("export")} disabled={!ready} className={primaryBtn}>
            Export…
          </button>
          <button onClick={() => setOpen("import")} className={ghostBtn}>
            Import…
          </button>
        </div>
        {note && <div className="text-[11.5px] text-accent2 mt-2.5">{note}</div>}
      </div>

      <div className="mt-3 bg-bg border border-border rounded-lg px-3 py-3">
        <div className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-1.5">
          Runner extension
        </div>
        <div className="text-[12.5px] text-muted mb-2.5">
          Runs a snippet straight from the Snippet dialog instead of a DevTools paste. Chrome or
          Edge only.
        </div>

        <button onClick={downloadExtension} disabled={zipping} className={primaryBtn}>
          {zipping ? "Preparing…" : "Download extension (.zip)"}
        </button>
        {zipError ? (
          <div className="text-[11.5px] text-red-400 mt-2.5">{zipError}</div>
        ) : zipNote ? (
          <div className="text-[11.5px] text-accent2 mt-2.5">{zipNote}</div>
        ) : null}

        <ol className="list-decimal ml-4 mt-3 text-[11.5px] text-muted space-y-1">
          <li>
            Unzip it somewhere permanent — Chrome loads the folder in place, so moving or deleting
            it later switches the extension off.
          </li>
          <li>
            Open <code className="text-text">chrome://extensions</code> and turn on{" "}
            <span className="text-text">Developer mode</span> (top right).
          </li>
          <li>
            Press <span className="text-text">Load unpacked</span> and pick the unzipped{" "}
            <code className="text-text">{EXTENSION_FOLDER}</code> folder — the one holding{" "}
            <code className="text-text">manifest.json</code>.
          </li>
          <li>
            Reload this tab, then press <span className="text-text">Open With Extensions</span> in a
            Snippet — the search runs and its results open in a new tab.
          </li>
        </ol>
      </div>

      <Modal open={open === "export"} title="Export POE data" onClose={close}>
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          <button onClick={copyExport} className={ghostBtn}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button onClick={download} className={ghostBtn}>
            Download .json
          </button>
        </div>
        <pre className="bg-bg border border-border rounded-lg p-2.5 text-[11.5px] font-mono text-muted whitespace-pre-wrap break-all max-h-[320px] overflow-y-auto">
          {ready ? exportedText : "Loading…"}
        </pre>
        <div className="text-[11.5px] text-muted mt-2.5">
          Copy this to back up every saved config, the Exchange lists and the selected league.
        </div>
      </Modal>

      <Modal open={open === "import"} title="Import POE data" onClose={close}>
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
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
          }}
          placeholder="Paste an exported JSON here, or load the file above."
          spellCheck={false}
          className={fieldClass}
        />

        <div className="flex items-center justify-between gap-3 flex-wrap mt-2.5">
          <div className="text-[11.5px] text-muted">
            {error || parseError ? (
              <span className="text-red-400">{error || parseError}</span>
            ) : preview ? (
              <>Replaces all POE data with {summarizePoeData(preview)}.</>
            ) : (
              "Replaces every saved config, the Exchange lists and the selected league."
            )}
          </div>
          <button onClick={apply} disabled={!preview} className={primaryBtn}>
            Replace POE data
          </button>
        </div>
      </Modal>
    </>
  );
}
