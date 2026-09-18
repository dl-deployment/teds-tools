// Pure color math for the Color Tools page. RGB is the hub format: every
// conversion goes through it, so no format converts directly to another.

export function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

export function isValidHex(hex) {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}

export function hexToRgb(hex) {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  return (
    "#" +
    [r, g, b].map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, "0")).join("")
  ).toUpperCase();
}

export function rgbToHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb({ h, s, l }) {
  h /= 360;
  s /= 100;
  l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

export function rgbToHsv({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (max !== min) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

export function hsvToRgb({ h, s, v }) {
  h /= 360;
  s /= 100;
  v /= 100;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

export function rgbToCmyk({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - r - k) / (1 - k)) * 100),
    m: Math.round(((1 - g - k) / (1 - k)) * 100),
    y: Math.round(((1 - b - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

export function cmykToRgb({ c, m, y, k }) {
  c /= 100;
  m /= 100;
  y /= 100;
  k /= 100;
  return {
    r: Math.round(255 * (1 - c) * (1 - k)),
    g: Math.round(255 * (1 - m) * (1 - k)),
    b: Math.round(255 * (1 - y) * (1 - k)),
  };
}

// ── Palette harmonics (operate on HSL) ──
function wrapHue(h) {
  return ((h % 360) + 360) % 360;
}

export function complementary({ h, s, l }) {
  return [{ h: wrapHue(h + 180), s, l }];
}

export function analogous({ h, s, l }) {
  return [-60, -30, 30, 60].map((offset) => ({ h: wrapHue(h + offset), s, l }));
}

export function triadic({ h, s, l }) {
  return [120, 240].map((offset) => ({ h: wrapHue(h + offset), s, l }));
}

export function tetradic({ h, s, l }) {
  return [90, 180, 270].map((offset) => ({ h: wrapHue(h + offset), s, l }));
}

export function splitComplementary({ h, s, l }) {
  return [150, 210].map((offset) => ({ h: wrapHue(h + offset), s, l }));
}

export function monochromatic({ h, s }) {
  return [20, 35, 65, 80].map((newL) => ({ h, s, l: newL }));
}

// ── WCAG 2.1 contrast ──
export function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function wcagResults(ratio) {
  return {
    aa: { normal: ratio >= 4.5, large: ratio >= 3 },
    aaa: { normal: ratio >= 7, large: ratio >= 4.5 },
  };
}

// ── Shades & tints ──
export function generateShades({ r, g, b }, count = 10) {
  const shades = [];
  for (let i = 1; i <= count; i++) {
    const factor = 1 - i / count;
    shades.push({ r: Math.round(r * factor), g: Math.round(g * factor), b: Math.round(b * factor) });
  }
  return shades;
}

export function generateTints({ r, g, b }, count = 10) {
  const tints = [];
  for (let i = 1; i <= count; i++) {
    const factor = i / count;
    tints.push({
      r: Math.round(r + (255 - r) * factor),
      g: Math.round(g + (255 - g) * factor),
      b: Math.round(b + (255 - b) * factor),
    });
  }
  return tints;
}

/** Black or white, whichever stays legible on the given background. */
export function textColorForBg(rgb) {
  return relativeLuminance(rgb) > 0.179 ? "#000000" : "#FFFFFF";
}

export function randomRgb() {
  return {
    r: Math.floor(Math.random() * 256),
    g: Math.floor(Math.random() * 256),
    b: Math.floor(Math.random() * 256),
  };
}

// ── Nearest CSS color name ──
const COLOR_NAMES = [
  ["000000","Black"],["000080","Navy"],["00008B","Dark Blue"],["0000CD","Medium Blue"],
  ["0000FF","Blue"],["006400","Dark Green"],["008000","Green"],["008080","Teal"],
  ["008B8B","Dark Cyan"],["00BFFF","Deep Sky Blue"],["00CED1","Dark Turquoise"],
  ["00FA9A","Medium Spring Green"],["00FF00","Lime"],["00FF7F","Spring Green"],
  ["00FFFF","Cyan"],["191970","Midnight Blue"],["1E90FF","Dodger Blue"],
  ["20B2AA","Light Sea Green"],["228B22","Forest Green"],["2E8B57","Sea Green"],
  ["2F4F4F","Dark Slate Gray"],["32CD32","Lime Green"],["3CB371","Medium Sea Green"],
  ["40E0D0","Turquoise"],["4169E1","Royal Blue"],["4682B4","Steel Blue"],
  ["483D8B","Dark Slate Blue"],["48D1CC","Medium Turquoise"],["4B0082","Indigo"],
  ["556B2F","Dark Olive Green"],["5F9EA0","Cadet Blue"],["6366F1","Indigo Dye"],
  ["6495ED","Cornflower Blue"],["66CDAA","Medium Aquamarine"],["696969","Dim Gray"],
  ["6A5ACD","Slate Blue"],["6B8E23","Olive Drab"],["708090","Slate Gray"],
  ["778899","Light Slate Gray"],["7B68EE","Medium Slate Blue"],["7CFC00","Lawn Green"],
  ["7FFF00","Chartreuse"],["7FFFD4","Aquamarine"],["800000","Maroon"],
  ["800080","Purple"],["808000","Olive"],["808080","Gray"],["87CEEB","Sky Blue"],
  ["87CEFA","Light Sky Blue"],["8A2BE2","Blue Violet"],["8B0000","Dark Red"],
  ["8B008B","Dark Magenta"],["8B4513","Saddle Brown"],["8FBC8F","Dark Sea Green"],
  ["90EE90","Light Green"],["9370DB","Medium Purple"],["9400D3","Dark Violet"],
  ["98FB98","Pale Green"],["9932CC","Dark Orchid"],["9ACD32","Yellow Green"],
  ["A0522D","Sienna"],["A52A2A","Brown"],["A9A9A9","Dark Gray"],
  ["ADD8E6","Light Blue"],["ADFF2F","Green Yellow"],["AFEEEE","Pale Turquoise"],
  ["B0C4DE","Light Steel Blue"],["B0E0E6","Powder Blue"],["B22222","Firebrick"],
  ["B8860B","Dark Goldenrod"],["BA55D3","Medium Orchid"],["BC8F8F","Rosy Brown"],
  ["BDB76B","Dark Khaki"],["C0C0C0","Silver"],["C71585","Medium Violet Red"],
  ["CD5C5C","Indian Red"],["CD853F","Peru"],["D2691E","Chocolate"],
  ["D2B48C","Tan"],["D3D3D3","Light Gray"],["D8BFD8","Thistle"],
  ["DA70D6","Orchid"],["DAA520","Goldenrod"],["DB7093","Pale Violet Red"],
  ["DC143C","Crimson"],["DCDCDC","Gainsboro"],["DDA0DD","Plum"],
  ["DEB887","Burly Wood"],["E0FFFF","Light Cyan"],["E6E6FA","Lavender"],
  ["E9967A","Dark Salmon"],["EE82EE","Violet"],["EEE8AA","Pale Goldenrod"],
  ["F08080","Light Coral"],["F0E68C","Khaki"],["F0F8FF","Alice Blue"],
  ["F0FFF0","Honeydew"],["F0FFFF","Azure"],["F4A460","Sandy Brown"],
  ["F5DEB3","Wheat"],["F5F5DC","Beige"],["F5F5F5","White Smoke"],
  ["F8F8FF","Ghost White"],["FA8072","Salmon"],["FAEBD7","Antique White"],
  ["FAF0E6","Linen"],["FAFAD2","Light Goldenrod Yellow"],["FDF5E6","Old Lace"],
  ["FF0000","Red"],["FF00FF","Magenta"],["FF1493","Deep Pink"],
  ["FF4500","Orange Red"],["FF6347","Tomato"],["FF69B4","Hot Pink"],
  ["FF7F50","Coral"],["FF8C00","Dark Orange"],["FFA07A","Light Salmon"],
  ["FFA500","Orange"],["FFB6C1","Light Pink"],["FFC0CB","Pink"],
  ["FFD700","Gold"],["FFDAB9","Peach Puff"],["FFDEAD","Navajo White"],
  ["FFE4B5","Moccasin"],["FFE4C4","Bisque"],["FFE4E1","Misty Rose"],
  ["FFEBCD","Blanched Almond"],["FFEFD5","Papaya Whip"],["FFF0F5","Lavender Blush"],
  ["FFF5EE","Seashell"],["FFF8DC","Cornsilk"],["FFFACD","Lemon Chiffon"],
  ["FFFAF0","Floral White"],["FFFAFA","Snow"],["FFFF00","Yellow"],
  ["FFFFE0","Light Yellow"],["FFFFF0","Ivory"],["FFFFFF","White"],
];

const PARSED_COLORS = COLOR_NAMES.map(([hex, name]) => [hexToRgb(hex), name]);

function colorDistance(a, b) {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

export function nearestColorName(rgb) {
  let best = PARSED_COLORS[0];
  let bestDist = Infinity;
  for (const [ref, name] of PARSED_COLORS) {
    const d = colorDistance(rgb, ref);
    if (d < bestDist) {
      bestDist = d;
      best = [ref, name];
    }
  }
  return best[1];
}
