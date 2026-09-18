export const toolList = [
  { key: "json", name: "JSON Formatter", desc: "Format & validate JSON", icon: "{ }", colorClass: "bg-accent/20 text-accent" },
  { key: "base64", name: "Base64 Encode/Decode", desc: "Encode or decode text", icon: "B64", colorClass: "bg-accent2/20 text-accent2" },
  { key: "uuid", name: "UUID Generator", desc: "Generate a random UUID", icon: "#", colorClass: "bg-accent3/20 text-accent3" },
  { key: "timestamp", name: "Timestamp Converter", desc: "Unix ⇄ readable date", icon: "⏱", colorClass: "bg-accent4/20 text-accent4" },
  { key: "diff", name: "Text Diff", desc: "Compare two texts", icon: "◫", colorClass: "bg-accent/20 text-accent" },
];

export function formatJson(input) {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch (e) {
    return "Invalid JSON: " + e.message;
  }
}

export function base64Encode(input) {
  try {
    return btoa(input);
  } catch (e) {
    return "Cannot encode: " + e.message;
  }
}

export function base64Decode(input) {
  try {
    return atob(input);
  } catch (e) {
    return "Invalid Base64.";
  }
}

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
