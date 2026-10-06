/**
 * The worker half: takes the snippet, runs the trade search and opens the
 * result.
 *
 * Manifest V3 forbids eval/`new Function` in extension code, so the snippet is
 * not executed verbatim — the three `const` declarations it is built from are
 * read back out of the text instead. They come from
 * `buildTradeSearchSnippet` in lib/poe.js, which always emits:
 *
 *   const url = "…";   const api = "…";   const payload = {…};
 *
 * If that shape changes, this reader has to change with it.
 */
function constant(script, name) {
  const match = script.match(new RegExp(`^\\s*const ${name} = (.+);\\s*$`, "m"));
  if (!match) throw new Error(`Could not read "${name}" from the snippet.`);
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    throw new Error(`"${name}" in the snippet is not valid JSON.`);
  }
}

async function runTradeScript(script) {
  const url = constant(script, "url");
  const api = constant(script, "api");
  const payload = constant(script, "payload");

  const res = await fetch(api, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Trade API returned HTTP ${res.status}.`);

  const data = await res.json();
  if (!data || !data.id) throw new Error("Trade API returned no search id.");

  const results = `${url}/${data.id}`;
  await chrome.tabs.create({ url: results });
  return { total: data.total, url: results };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "RUN_TRADE_SCRIPT") return;

  runTradeScript(msg.script)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((e) => sendResponse({ ok: false, error: e.message }));

  // Keeps the message channel open for the reply above, which is async.
  return true;
});
