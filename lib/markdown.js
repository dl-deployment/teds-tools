/**
 * Minimal Markdown → HTML renderer for the Text Tools "MarkDown" tab.
 *
 * Pure: source string in, HTML string out — no DOM, no state.
 *
 * Raw HTML in the source is escaped rather than passed through, and link/image
 * targets are restricted to a scheme allowlist, so the result is safe to inject
 * with `dangerouslySetInnerHTML` even for a file the user did not write.
 *
 * Not a full CommonMark implementation — it covers what a README or a note
 * actually uses: ATX + setext headings, fenced code, blockquotes, nested lists,
 * task lists, GFM tables, thematic breaks, and the usual inline spans. No class
 * names are emitted (Tailwind doesn't scan `lib/` — see CLAUDE.md rule 4); the
 * preview styles the tags it renders via child selectors instead.
 */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

// Allowlist rather than a `javascript:` blocklist: anything not matching one of
// these is dropped, so an unexpected scheme can't slip through.
const HREF_SCHEMES = /^(?:https?:|mailto:|tel:|#|\/|\.{1,2}\/)/i;
const SRC_SCHEMES = /^(?:https?:|data:image\/|\/|\.{1,2}\/)/i;

function safeUrl(url, schemes) {
  const clean = String(url).trim().replace(/[\u0000-\u001f\u007f]/g, "");
  // Real targets never contain whitespace, so anything that does is malformed
  // rather than a url — drop it instead of building a nonsense href.
  if (/\s/.test(clean)) return "";
  return schemes.test(clean) ? clean : "";
}

const LIST_ITEM_RE = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(.*)$/;
const TASK_RE = /^\[([ xX])\]\s+(.*)$/;
const THEMATIC_BREAK_RE = /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/;
const TABLE_DIVIDER_RE = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

const indentOf = (line) => line.match(/^\s*/)[0].length;

/** Wraps inline parsing so generated HTML is held aside and never re-parsed. */
function createInlineState() {
  const kept = [];
  return {
    keep(html) {
      kept.push(html);
      return `\u0000${kept.length - 1}\u0000`;
    },
    restore(text) {
      let out = text;
      for (let pass = 0; pass < 8 && out.indexOf("\u0000") !== -1; pass += 1) {
        out = out.replace(/\u0000(\d+)\u0000/g, (full, index) => kept[Number(index)] ?? "");
      }
      return out;
    },
  };
}

// The target allows one level of balanced parentheses, so a url like
// `https://en.wikipedia.org/wiki/Foo_(bar)` (or a `(title)` suffix) parses.
const LINK_RE = /(!?)\[([^\]]*)\]\(((?:[^()]|\([^()]*\))*)\)/g;
const AUTOLINK_RE = /<((?:https?:\/\/|mailto:)[^\s<>]+)>/g;

/** Splits the inside of a `[text](...)` target into its url and optional title. */
function splitTarget(inside) {
  const match = /^\s*(\S+?)(?:\s+["'(]([^"')]*)["')])?\s*$/.exec(inside);
  return match ? { url: match[1], title: match[2] || "" } : { url: inside.trim(), title: "" };
}

function renderInline(source, { links = true, state = createInlineState() } = {}) {
  let text = String(source);

  // Backslash escapes first: the escaped character is literal, never markup.
  text = text.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, (full, ch) => state.keep(escapeHtml(ch)));

  // Code spans before anything else so their contents stay verbatim.
  text = text.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (full, ticks, code) =>
    state.keep(`<code>${escapeHtml(code.trim())}</code>`)
  );

  text = text.replace(LINK_RE, (full, bang, label, target) => {
    const { url, title } = splitTarget(target);
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";

    if (bang) {
      const src = safeUrl(url, SRC_SCHEMES);
      return src
        ? state.keep(`<img src="${escapeHtml(src)}" alt="${escapeHtml(label)}"${titleAttr}>`)
        : state.keep(escapeHtml(label));
    }
    const inner = renderInline(label, { links: false, state });
    const href = links ? safeUrl(url, HREF_SCHEMES) : "";
    return href
      ? state.keep(
          `<a href="${escapeHtml(href)}"${titleAttr} target="_blank" rel="noopener noreferrer">${inner}</a>`
        )
      : state.keep(inner);
  });

  text = text.replace(AUTOLINK_RE, (full, url) => {
    const href = safeUrl(url, HREF_SCHEMES);
    return href
      ? state.keep(
          `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`
        )
      : full;
  });

  // Everything still literal is text, not markup.
  text = escapeHtml(text);

  text = text.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([\s\S]+?)__/g, "<strong>$1</strong>");
  text = text.replace(/(?<![\w*])\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>");
  text = text.replace(/(?<![\w])_([^_\n]+?)_(?![\w])/g, "<em>$1</em>");
  text = text.replace(/~~([\s\S]+?)~~/g, "<del>$1</del>");

  // Hard breaks: two trailing spaces or a trailing backslash.
  text = text.replace(/ {2,}\n/g, "<br>\n").replace(/\\\n/g, "<br>\n");

  return state.restore(text);
}

/** True for a line that opens its own block, so a paragraph must stop there. */
function isBlockStart(line) {
  if (!line.trim()) return true;
  if (/^ {0,3}(`{3,}|~{3,})/.test(line)) return true;
  if (/^ {0,3}#{1,6}\s/.test(line)) return true;
  if (/^ {0,3}>/.test(line)) return true;
  if (THEMATIC_BREAK_RE.test(line)) return true;
  return LIST_ITEM_RE.test(line);
}

function splitTableRow(line) {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|")) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, "|").trim());
}

function renderTable(lines, start) {
  const header = splitTableRow(lines[start]);
  const aligns = splitTableRow(lines[start + 1]).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return left ? "left" : "";
  });
  const cellAttr = (tag, index) => {
    const align = aligns[index];
    return `<${tag}${align ? ` style="text-align:${align}"` : ""}>`;
  };

  let i = start + 2;
  const body = [];
  while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
    body.push(splitTableRow(lines[i]));
    i += 1;
  }

  const head = header
    .map((cell, index) => `${cellAttr("th", index)}${renderInline(cell)}</th>`)
    .join("");
  const rows = body
    .map(
      (cells) =>
        `<tr>${cells
          .map((cell, index) => `${cellAttr("td", index)}${renderInline(cell)}</td>`)
          .join("")}</tr>`
    )
    .join("\n");

  return {
    html: `<table>\n<thead>\n<tr>${head}</tr>\n</thead>\n<tbody>\n${rows}\n</tbody>\n</table>`,
    next: i,
  };
}

/** Parses one list, recursing into nested lists through the item bodies. */
function renderList(lines, start) {
  const first = LIST_ITEM_RE.exec(lines[start]);
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const startNumber = ordered ? parseInt(first[2], 10) : 1;
  // Where the first item's own text starts. A line indented at least this far
  // is part of the current item (and so may open a nested list); anything less
  // is a sibling item. This is what keeps a 2-space-indented child nested.
  const levelIndent = baseIndent + first[2].length + first[3].length;
  const items = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      const next = lines[i + 1];
      const continues = next && (LIST_ITEM_RE.test(next) || indentOf(next) >= levelIndent);
      if (!continues || !items.length) break;
      items[items.length - 1].body.push("");
      i += 1;
      continue;
    }

    const match = LIST_ITEM_RE.exec(line);
    const indent = indentOf(line);

    if (match && indent < levelIndent) {
      if (/\d/.test(match[2]) !== ordered) break; // the other kind starts a new list
      items.push({ first: match[4], body: [], contentIndent: indent + match[2].length + match[3].length });
      i += 1;
      continue;
    }

    if (indent >= levelIndent && items.length) {
      const item = items[items.length - 1];
      item.body.push(line.slice(Math.min(indent, item.contentIndent)));
      i += 1;
      continue;
    }

    break;
  }

  const rendered = items.map((item) => {
    let text = item.first;
    let checkbox = "";
    const task = TASK_RE.exec(text);
    if (task) {
      checkbox = `<input type="checkbox" disabled${task[1].toLowerCase() === "x" ? " checked" : ""}> `;
      text = task[2];
    }
    const inner = renderBlocks([text, ...item.body]).trim();
    // A tight list draws its first paragraph unwrapped, so the item keeps the
    // list's own rhythm instead of picking up a paragraph's margins.
    const tight = /^<p>([\s\S]*?)<\/p>\s*/.exec(inner);
    return `<li>${checkbox}${tight ? inner.replace(tight[0], `${tight[1]}\n`) : inner}</li>`;
  });

  const tag = ordered ? "ol" : "ul";
  const startAttr = ordered && startNumber !== 1 ? ` start="${startNumber}"` : "";
  return { html: `<${tag}${startAttr}>\n${rendered.join("\n")}\n</${tag}>`, next: i };
}

function renderBlocks(lines) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = /^ {0,3}(`{3,}|~{3,})\s*(\S*)/.exec(line);
    if (fence) {
      const closing = new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}\\s*$`);
      const body = [];
      i += 1;
      while (i < lines.length && !closing.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // the closing fence, or EOF
      const lang = fence[2] ? ` data-lang="${escapeHtml(fence[2])}"` : "";
      out.push(`<pre${lang}>${escapeHtml(body.join("\n"))}</pre>`);
      continue;
    }

    const heading = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (THEMATIC_BREAK_RE.test(line)) {
      out.push("<hr>");
      i += 1;
      continue;
    }

    // Setext heading: a paragraph line underlined by `=` or `-`.
    const underline = /^ {0,3}(=+|-+)\s*$/.exec(lines[i + 1] || "");
    if (underline && !LIST_ITEM_RE.test(line)) {
      const level = underline[1][0] === "=" ? 1 : 2;
      out.push(`<h${level}>${renderInline(line.trim())}</h${level}>`);
      i += 2;
      continue;
    }

    if (
      line.includes("|") &&
      lines[i + 1] &&
      TABLE_DIVIDER_RE.test(lines[i + 1]) &&
      lines[i + 1].includes("-")
    ) {
      const table = renderTable(lines, i);
      out.push(table.html);
      i = table.next;
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      const inner = [];
      while (i < lines.length && lines[i].trim()) {
        if (!/^ {0,3}>/.test(lines[i]) && isBlockStart(lines[i])) break; // lazy continuation only
        inner.push(lines[i].replace(/^ {0,3}> ?/, ""));
        i += 1;
      }
      out.push(`<blockquote>\n${renderBlocks(inner)}\n</blockquote>`);
      continue;
    }

    if (LIST_ITEM_RE.test(line)) {
      const list = renderList(lines, i);
      out.push(list.html);
      i = list.next;
      continue;
    }

    const paragraph = [];
    while (i < lines.length && !isBlockStart(lines[i])) {
      paragraph.push(lines[i].replace(/^\s+/, "")); // trailing spaces are a hard break
      i += 1;
    }
    if (paragraph.length) {
      out.push(`<p>${renderInline(paragraph.join("\n"))}</p>`);
      continue;
    }

    // Safety net: a line no branch claimed is still text, and must consume.
    out.push(`<p>${renderInline(line)}</p>`);
    i += 1;
  }

  return out.join("\n");
}

/** Renders Markdown source to an HTML string safe to inject. */
export function renderMarkdown(source) {
  if (!source) return "";
  return renderBlocks(String(source).replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n"));
}
