import fs from "node:fs";
import path from "node:path";

/**
 * Static pages live in `public/static_pages` as either a folder containing an
 * `index.html` or a loose `.html` file. These helpers use `node:fs`, so they
 * may only be imported from server components.
 */
export function formatPageName(name) {
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function scanStaticPages(dir) {
  if (!fs.existsSync(dir)) return [];

  const pages = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      if (fs.existsSync(path.join(full, "index.html"))) {
        pages.push({ name: entry, type: "folder", href: `/static_pages/${entry}/index.html` });
      }
    } else if (entry.endsWith(".html")) {
      pages.push({ name: entry.replace(/\.html$/, ""), type: "file", href: `/static_pages/${entry}` });
    }
  }

  return pages.sort((a, b) => a.name.localeCompare(b.name));
}
