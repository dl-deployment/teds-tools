// Pure helpers for the Assets Tools section: Cocos Creator atlas metadata
// (read and write) and shelf packing. `parsePlist` is the one exception —
// it uses DOMParser, so it only runs in the browser.

/** Cocos stores rects/sizes as "{{x,y},{w,h}}" / "{w,h}" — pull the numbers out. */
export function numsFromCocosStr(str) {
  const m = (str || "").match(/\d+/g);
  return m ? m.map(Number) : null;
}

export function toRect(nums) {
  if (!nums || nums.length < 4) return null;
  return { x: nums[0], y: nums[1], w: nums[2], h: nums[3] };
}

export function toSize(nums) {
  if (!nums || nums.length < 2) return null;
  return { w: nums[0], h: nums[1] };
}

export function toPoint(nums) {
  if (!nums || nums.length < 2) return null;
  return { x: nums[0], y: nums[1] };
}

/** Minimal Apple property list → JS object. */
export function parsePlist(xmlStr) {
  const doc = new DOMParser().parseFromString(xmlStr, "text/xml");
  if (doc.querySelector("parsererror")) return null;

  function walk(node) {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return null;
    switch (node.tagName) {
      case "plist": {
        for (let c = node.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) return walk(c);
        return null;
      }
      case "dict": {
        const obj = {};
        const kids = [];
        for (let c = node.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) kids.push(c);
        for (let i = 0; i + 1 < kids.length; i += 2) {
          if (kids[i].tagName === "key") obj[kids[i].textContent.trim()] = walk(kids[i + 1]);
        }
        return obj;
      }
      case "string":
        return node.textContent.trim();
      case "integer":
        return parseInt(node.textContent.trim(), 10);
      case "real":
        return parseFloat(node.textContent.trim());
      case "true":
        return true;
      case "false":
        return false;
      case "array": {
        const arr = [];
        for (let c = node.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) arr.push(walk(c));
        return arr;
      }
      default:
        return null;
    }
  }
  return walk(doc.documentElement);
}

/**
 * Flatten parsed plist data into the frames the Slicer draws and cuts.
 *
 * Cocos Creator stores the *unrotated* size in a frame rect; the atlas holds
 * that frame rotated 90°, so its real texture rect has w/h swapped. That
 * swapped rect is `displayFrame` — what the overlay draws and what gets cut.
 */
export function plistFrames(plistData) {
  if (!plistData || !plistData.frames) return [];
  return Object.entries(plistData.frames).flatMap(([name, data]) => {
    if (typeof data !== "object" || !data.frame) return [];
    const frame = toRect(numsFromCocosStr(data.frame));
    const sourceSize = toSize(numsFromCocosStr(data.sourceSize || ""));
    const sourceColorRect = toRect(numsFromCocosStr(data.sourceColorRect || ""));
    const offset = toPoint(numsFromCocosStr(data.offset || ""));
    const rotated = !!data.rotated;
    if (!frame || !sourceSize) return [];
    return [
      {
        name: name.replace(/\.[^/.]+$/, ""),
        rawName: name,
        frame,
        displayFrame: rotated ? { x: frame.x, y: frame.y, w: frame.h, h: frame.w } : frame,
        rotated,
        sourceSize,
        sourceColorRect: sourceColorRect || { x: 0, y: 0, w: frame.w, h: frame.h },
        offset: offset || { x: 0, y: 0 },
      },
    ];
  });
}

/**
 * Shelf packing: biggest images first, filled left to right until the row
 * would exceed maxWidth, then a new shelf starts below the tallest row.
 */
export function shelfPack(frames, padding, maxWidth) {
  if (frames.length === 0) return { packed: [], width: 64, height: 64 };

  const sorted = [...frames].sort((a, b) => b.w * b.h - a.w * a.h);
  const packed = [];
  let shelfY = padding;
  let currentX = padding;
  let rowHeight = 0;
  let lineW = 0;

  for (const f of sorted) {
    if (currentX + f.w + padding > maxWidth) {
      lineW = Math.max(lineW, currentX);
      currentX = padding;
      shelfY += rowHeight + padding;
      rowHeight = 0;
    }
    packed.push({ ...f, x: currentX, y: shelfY });
    currentX += f.w + padding;
    rowHeight = Math.max(rowHeight, f.h);
  }

  lineW = Math.max(lineW, currentX);
  return { packed, width: lineW, height: shelfY + rowHeight + padding };
}

export function nextPow2(v) {
  return 1 << (32 - Math.clz32(v - 1));
}

/** Share of the atlas actually covered by packed frames, as a 0-100 number. */
export function atlasUsage(packed, width, height) {
  const used = packed.reduce((sum, f) => sum + f.w * f.h, 0);
  return ((used / (width * height)) * 100).toFixed(1);
}

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Cocos Creator 2.x style atlas metadata for a packed sheet. */
export function buildCocosPlist({ frames, width, height, textureFileName = "spritesheet.png" }) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "    <dict>",
    "        <key>frames</key>",
    "        <dict>",
  ];

  for (const f of frames) {
    lines.push(`            <key>${escapeXml(f.name)}</key>`);
    lines.push("            <dict>");
    lines.push("                <key>frame</key>");
    lines.push(`                <string>{{${f.x},${f.y}},{${f.w},${f.h}}}</string>`);
    lines.push("                <key>offset</key>");
    lines.push("                <string>{0,0}</string>");
    lines.push("                <key>rotated</key>");
    lines.push("                <false/>");
    lines.push("                <key>sourceColorRect</key>");
    lines.push(`                <string>{{0,0},{${f.w},${f.h}}}</string>`);
    lines.push("                <key>sourceSize</key>");
    lines.push(`                <string>{${f.w},${f.h}}</string>`);
    lines.push("            </dict>");
  }

  lines.push(
    "        </dict>",
    "        <key>metadata</key>",
    "        <dict>",
    "            <key>format</key>",
    "            <integer>2</integer>",
    "            <key>realTextureFileName</key>",
    `            <string>${escapeXml(textureFileName)}</string>`,
    "            <key>size</key>",
    `            <string>{${width},${height}}</string>`,
    "            <key>textureFileName</key>",
    `            <string>${escapeXml(textureFileName)}</string>`,
    "        </dict>",
    "    </dict>",
    "</plist>",
    ""
  );

  return lines.join("\n");
}
