/**
 * Runs on the Ted's Tools pages. The Snippet dialog posts the trade snippet on
 * `window`, so it lands here first — then goes straight to the service worker,
 * because the trade API only answers a request made with the extension's host
 * permissions. A fetch from the page itself (or from this content script, which
 * inherits the page's origin) would be rejected by CORS.
 */
window.addEventListener("message", (event) => {
  // A frame on the page can post too; only the hub's own window is trusted.
  if (event.source !== window) return;

  const data = event.data;
  if (!data || data.source !== "TEDSTOOLS" || data.type !== "EXECUTE_SCRIPT") return;
  if (typeof data.script !== "string" || !data.script) return;

  chrome.runtime
    .sendMessage({ type: "RUN_TRADE_SCRIPT", script: data.script })
    .then((res) => {
      if (res && res.ok === false) console.error("[Ted's Tools] trade search failed:", res.error);
      else if (res) console.log("[Ted's Tools] trade search:", res.total, "results —", res.url);
    })
    .catch((e) => {
      // The worker is normally woken by the message; this only fires if the
      // extension was reloaded out from under an already-open hub tab.
      console.error("[Ted's Tools] extension unreachable:", e);
    });
});
