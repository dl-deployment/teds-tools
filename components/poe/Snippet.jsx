"use client";

import Modal from "@/components/Modal";
import { tradeSearchUrl } from "@/lib/poe";

/** Clipboard API needs a secure context; bare http falls back to execCommand. */
export async function copyText(text) {
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

/**
 * Hands the snippet to a browser extension listening on the page, which runs it
 * in the trade site's own tab instead of the user pasting it into DevTools.
 */
function openWithExtensions(snippet) {
  window.postMessage(
    { source: "TEDSHUB", type: "EXECUTE_SCRIPT", script: snippet },
    "*"
  );
}

/**
 * The console snippet plus a link to the trade site. Shared by the Trade tab
 * (one saved config) and the Maker tab (a merged selection), so both explain
 * the same paste-into-DevTools step.
 */
export default function SnippetModal({ open, title, snippet, league, onClose }) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <button
          onClick={() => copyText(snippet)}
          className="bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px]"
        >
          Copy
        </button>
        <button
          onClick={() => openWithExtensions(snippet)}
          className="bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px]"
        >
          Open With Extensions
        </button>
        <a
          href={tradeSearchUrl(league)}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-transparent border border-border text-accent px-2.5 py-1.5 rounded-lg text-[12.5px] no-underline"
        >
          Open {league} trade ↗
        </a>
      </div>
      <pre className="bg-bg border border-border rounded-lg p-3 text-[12px] font-mono text-muted whitespace-pre-wrap break-all max-h-[320px] overflow-y-auto">
        {snippet}
      </pre>
      <div className="text-[11.5px] text-muted mt-2.5">
        Paste it into the DevTools console (F12) on that page and press Enter — the search runs
        same-origin and opens the results in a new tab.
      </div>
    </Modal>
  );
}
