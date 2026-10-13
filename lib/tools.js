import { md5 } from "./md5.js";

export const toolList = [
  { key: "timeline", name: "Event Timeline", desc: "Holidays & countdowns", icon: "◷", colorClass: "bg-accent2/20 text-accent2" },
  { key: "uuid", name: "UUID Generator", desc: "Generate a random UUID", icon: "#", colorClass: "bg-accent3/20 text-accent3" },
  { key: "timestamp", name: "Timestamp Converter", desc: "Unix ⇄ readable date", icon: "⏱", colorClass: "bg-accent4/20 text-accent4" },
  { key: "diff", name: "Text Diff", desc: "Compare two texts", icon: "◫", colorClass: "bg-accent/20 text-accent" },
];

export function generateUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function convertTimestamp(input) {
  const t = (input || "").trim();
  const ms = t ? Number(t) * 1000 : Date.now();
  if (t && isNaN(ms)) return "Enter a valid unix timestamp.";
  const d = new Date(ms);
  return `Local:  ${d.toString()}\nISO:    ${d.toISOString()}\nUnix:   ${Math.floor(ms / 1000)}`;
}

export function textDiff(a, b) {
  const la = (a || "").split("\n");
  const lb = (b || "").split("\n");
  const max = Math.max(la.length, lb.length);
  const out = [];
  for (let i = 0; i < max; i++) {
    const x = la[i] ?? "";
    const y = lb[i] ?? "";
    out.push(x === y ? `  ${x}` : `- ${x}\n+ ${y}`);
  }
  return out.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Text Tools (app/texttools) — transforms applied in place to one text buffer.
// Unlike the helpers above, these throw on invalid input instead of returning
// an error string, so the page can surface a single error toast.
// ─────────────────────────────────────────────────────────────────────────────

// ── JSON ──
export function formatJsonPretty(input) {
  return JSON.stringify(JSON.parse(input), null, 2);
}

export function formatJsonMinify(input) {
  return JSON.stringify(JSON.parse(input));
}

// ── Case ──
export function toUpper(text) {
  return text.toUpperCase();
}

export function toLower(text) {
  return text.toLowerCase();
}

export function toTitleCase(text) {
  return text.replace(/\b\w+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

export function splitWords(text) {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-]+/g, " ")
    .trim()
    .split(/\s+/);
}

export function toCamelCase(text) {
  return splitWords(text)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
}

export function toSnakeCase(text) {
  return splitWords(text)
    .map((w) => w.toLowerCase())
    .join("_");
}

export function toKebabCase(text) {
  return splitWords(text)
    .map((w) => w.toLowerCase())
    .join("-");
}

// ── Trim ──
export function trimText(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Base64 (UTF-8 safe) ──
export function base64EncodeUnicode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function base64DecodeUnicode(text) {
  const binary = atob(text);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

// ── URL ──
export function urlEncode(text) {
  return encodeURIComponent(text);
}

export function urlDecode(text) {
  return decodeURIComponent(text);
}

// ── HTML entities ──
const HTML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: String.fromCharCode(34), apos: String.fromCharCode(39), nbsp: String.fromCharCode(160) };

export function htmlEncode(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

export function htmlDecode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => HTML_ENTITIES[e]);
}

// ── JWT ──
export function jwtDecode(text) {
  const parts = text.trim().split(".");
  if (parts.length < 2) throw new Error("Invalid JWT");
  const pad = (s) => s + "=".repeat((4 - (s.length % 4)) % 4);
  const decodePart = (s) => JSON.parse(atob(pad(s.replace(/-/g, "+").replace(/_/g, "/"))));
  return JSON.stringify({ header: decodePart(parts[0]), payload: decodePart(parts[1]) }, null, 2);
}

// ── XML / HTML ──
export function formatXml(text) {
  let formatted = "";
  let indent = 0;
  const lines = text.replace(/(>)\s*(<)/g, "$1\n$2").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("</")) indent = Math.max(indent - 1, 0);
    formatted += "  ".repeat(indent) + trimmed + "\n";
    if (trimmed.match(/^<[^/!?]/) && !trimmed.match(/\/>$/) && !trimmed.match(/<\/.*>$/)) indent++;
  }
  return formatted.trim();
}

// ── SQL ──
const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "AND", "OR", "ORDER BY", "GROUP BY", "HAVING", "LIMIT",
  "OFFSET", "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "JOIN",
  "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "OUTER JOIN", "ON", "AS", "IN", "NOT",
  "NULL", "IS", "LIKE", "BETWEEN", "UNION", "ALL", "DISTINCT", "CREATE", "TABLE",
  "ALTER", "DROP", "INDEX", "INTO",
];

export function formatSql(text) {
  let result = text.replace(/\s+/g, " ").trim();
  for (const kw of SQL_KEYWORDS) {
    result = result.replace(new RegExp(`\\b${kw}\\b`, "gi"), `\n${kw}`);
  }
  return result.trim();
}

// ── Lines ──
export function sortLinesAsc(text) {
  return text.split("\n").sort((a, b) => a.localeCompare(b)).join("\n");
}

export function sortLinesDesc(text) {
  return text.split("\n").sort((a, b) => b.localeCompare(a)).join("\n");
}

export function dedupLines(text) {
  return [...new Set(text.split("\n"))].join("\n");
}

export function reverseLines(text) {
  return text.split("\n").reverse().join("\n");
}

export function addLineNumbers(text) {
  return text
    .split("\n")
    .map((l, i) => `${i + 1}  ${l}`)
    .join("\n");
}

// ── Protobuf (decode a base64-encoded message into its fields) ──
export function protobufDecode(text) {
  const raw = atob(text.trim());
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return formatProtobufFields(decodeProtobuf(bytes, 0).result, 0);
}

function formatProtobufFields(fields, indent) {
  const pad = "  ".repeat(indent);
  return fields
    .map((f) => {
      const prefix = `${pad}${f.fieldNumber} [${f.type}]`;
      if (f.repeated) {
        const values = f.value
          .map((v) =>
            typeof v === "object" && !Array.isArray(v)
              ? `${pad}  ${formatProtobufFields([v], indent + 2)}`
              : `${pad}  ${v}`
          )
          .join(",\n");
        return `${prefix}: [\n${values}\n${pad}]`;
      }
      if (f.type === "message") return `${prefix}:\n${formatProtobufFields(f.value, indent + 1)}`;
      return `${prefix}: ${f.value}`;
    })
    .join("\n");
}

function decodeProtobuf(bytes, offset) {
  const fields = [];
  while (offset < bytes.length) {
    const tag = decodeVarint(bytes, offset);
    if (tag === null) break;
    const fieldNumber = tag.value >> 3;
    const wireType = tag.value & 0x07;
    offset = tag.next;

    const field = { fieldNumber, wireType };
    if (wireType === 0) {
      const v = decodeVarint(bytes, offset);
      if (v === null) throw new Error(`Truncated varint at field ${fieldNumber}`);
      field.type = "varint";
      field.value = v.value;
      offset = v.next;
    } else if (wireType === 1) {
      if (offset + 8 > bytes.length) throw new Error(`Truncated 64-bit at field ${fieldNumber}`);
      field.type = "fixed64";
      const dv = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
      const hex = [...bytes.slice(offset, offset + 8)]
        .reverse()
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      field.value = `${dv.getFloat64(0, true)} (0x${hex})`;
      offset += 8;
    } else if (wireType === 2) {
      const len = decodeVarint(bytes, offset);
      if (len === null) throw new Error(`Truncated length at field ${fieldNumber}`);
      offset = len.next;
      if (offset + len.value > bytes.length) throw new Error(`Truncated data at field ${fieldNumber}`);
      const sub = bytes.slice(offset, offset + len.value);
      if (isPrintableBytes(sub)) {
        field.type = "string";
        field.value = new TextDecoder().decode(sub);
      } else {
        const nested = decodeProtobuf(sub, 0);
        if (sub.length >= 2 && nested.result.length > 0 && nested.offset === sub.length) {
          field.type = "message";
          field.value = nested.result;
        } else {
          field.type = "bytes";
          field.value = [...sub].map((b) => b.toString(16).padStart(2, "0")).join(" ");
        }
      }
      offset += len.value;
    } else if (wireType === 5) {
      if (offset + 4 > bytes.length) throw new Error(`Truncated 32-bit at field ${fieldNumber}`);
      field.type = "fixed32";
      field.value = `0x${[...bytes.slice(offset, offset + 4)]
        .reverse()
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")}`;
      offset += 4;
    } else {
      field.type = "unknown";
      field.value = `wireType=${wireType}`;
    }

    const last = fields[fields.length - 1];
    if (last && last.fieldNumber === field.fieldNumber && last.type === field.type && !Array.isArray(last.value)) {
      last.value = [last.value, field.value];
      last.repeated = true;
    } else if (last && last.fieldNumber === field.fieldNumber && last.repeated) {
      last.value.push(field.value);
    } else {
      fields.push(field);
    }
  }
  return { result: fields, offset };
}

function decodeVarint(bytes, offset) {
  let value = 0;
  let shift = 0;
  while (offset < bytes.length) {
    const byte = bytes[offset++];
    value |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) return { value, next: offset };
    shift += 7;
    if (shift > 63) throw new Error("Varint too long");
  }
  return null;
}

function isPrintableBytes(bytes) {
  if (bytes.length === 0) return false;
  for (const b of bytes) {
    if (b < 32 && b !== 9 && b !== 10 && b !== 13) return false;
    if (b > 126) return false;
  }
  return true;
}

// ── Hashes ──
export async function hashMd5(text) {
  return md5(text);
}

export async function hashSha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Tool groups for the Text Tools page's sub-sidebar, mirroring `toolList`
 * above. A group has either several `options` (each rendered as its own
 * button) or a single `action`.
 */
export const textToolList = [
  {
    key: "json", name: "JSON", desc: "Pretty-print or minify", icon: "{ }", colorClass: "bg-accent/20 text-accent",
    options: [
      { label: "Pretty", action: formatJsonPretty },
      { label: "Minify", action: formatJsonMinify },
    ],
  },
  // No `action`: this tab's pane is the drop zone + rendered preview in
  // `components/texttools/MarkdownPanel.jsx`, not a transform of the buffer.
  { key: "md", name: "MarkDown", desc: "Preview a .md file", icon: "MD", colorClass: "bg-accent4/20 text-accent4", options: [] },
  {
    key: "case", name: "Case", desc: "Convert naming convention", icon: "Aa", colorClass: "bg-accent2/20 text-accent2",
    options: [
      { label: "UPPER", action: toUpper },
      { label: "lower", action: toLower },
      { label: "Title Case", action: toTitleCase },
      { label: "camelCase", action: toCamelCase },
      { label: "snake_case", action: toSnakeCase },
      { label: "kebab-case", action: toKebabCase },
    ],
  },
  { key: "trim", name: "Trim", desc: "Trim each line, collapse blanks", icon: "⌫", colorClass: "bg-accent3/20 text-accent3", action: trimText },
  {
    key: "base64", name: "Base64", desc: "Encode or decode (UTF-8)", icon: "B64", colorClass: "bg-accent4/20 text-accent4",
    options: [
      { label: "Encode", action: base64EncodeUnicode },
      { label: "Decode", action: base64DecodeUnicode },
    ],
  },
  {
    key: "url", name: "URL", desc: "Encode or decode", icon: "%", colorClass: "bg-accent/20 text-accent",
    options: [
      { label: "Encode", action: urlEncode },
      { label: "Decode", action: urlDecode },
    ],
  },
  {
    key: "html", name: "HTML", desc: "Entity encode or decode", icon: "<>", colorClass: "bg-accent2/20 text-accent2",
    options: [
      { label: "Encode", action: htmlEncode },
      { label: "Decode", action: htmlDecode },
    ],
  },
  {
    key: "jwt", name: "JWT", desc: "Decode header and payload", icon: "JWT", colorClass: "bg-accent3/20 text-accent3",
    options: [{ label: "Decode", action: jwtDecode }],
  },
  {
    key: "format", name: "Format", desc: "XML / HTML or SQL", icon: "¶", colorClass: "bg-accent4/20 text-accent4",
    options: [
      { label: "XML / HTML", action: formatXml },
      { label: "SQL", action: formatSql },
    ],
  },
  {
    key: "lines", name: "Lines", desc: "Sort, dedupe, reverse, number", icon: "≡", colorClass: "bg-accent/20 text-accent",
    options: [
      { label: "Sort A→Z", action: sortLinesAsc },
      { label: "Sort Z→A", action: sortLinesDesc },
      { label: "Remove Duplicates", action: dedupLines },
      { label: "Reverse", action: reverseLines },
      { label: "Add Numbers", action: addLineNumbers },
    ],
  },
  {
    key: "proto", name: "Protobuf", desc: "Decode a base64 message", icon: "PB", colorClass: "bg-accent2/20 text-accent2",
    options: [{ label: "Decode (Base64)", action: protobufDecode }],
  },
  {
    key: "hash", name: "Hash", desc: "MD5 or SHA-256", icon: "#", colorClass: "bg-accent3/20 text-accent3",
    options: [
      { label: "MD5", action: hashMd5 },
      { label: "SHA-256", action: hashSha256 },
    ],
  },
];
