"use client";

import { useState } from "react";
import { useHubData } from "@/lib/useHubData";
import { EmptyState } from "@/components/ItemRow";
import Modal from "@/components/Modal";
import { SubSidebar, SubItem, SubAction, ContentPane } from "@/components/SubSidebar";
import { downloadBlob } from "@/lib/zip";
import { LINKS_FILE, buildLinksFile } from "@/lib/hub";

const ghostBtn =
  "flex-shrink-0 bg-transparent border border-border text-muted hover:text-text px-2.5 py-1.5 rounded-lg text-[12.5px] disabled:opacity-40";

function hrefOf(url) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function hostOf(url) {
  try {
    return new URL(hrefOf(url)).host;
  } catch (e) {
    return url;
  }
}

export default function LinksPage() {
  const { links, addLink, removeLink } = useHubData();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [activeId, setActiveId] = useState(null);

  const list = [...links].reverse();
  const active = list.find((l) => l.id === activeId) || list[0] || null;

  function save() {
    if (!name.trim() || !url.trim()) return;
    const created = addLink({ name, url });
    if (created) setActiveId(created.id);
    setName("");
    setUrl("");
    setOpen(false);
  }

  /**
   * The links in the bundled file's shape, so the download can replace
   * `public/hub/links.json` and become the default for a browser that has never
   * seeded.
   */
  function exportFile() {
    downloadBlob(
      new Blob([JSON.stringify(buildLinksFile(links), null, 2)], { type: "application/json" }),
      LINKS_FILE
    );
  }

  return (
    <>
      <SubSidebar
        title="Links"
        action={<SubAction onClick={() => setOpen(true)} title="New link">+</SubAction>}
      >
        {list.length === 0 ? (
          <div className="text-[12.5px] text-muted px-2.5 py-2">Nothing here yet.</div>
        ) : (
          list.map((l) => (
            <SubItem
              key={l.id}
              active={active?.id === l.id}
              onClick={() => setActiveId(l.id)}
              label={l.name}
              sub={hostOf(l.url)}
              icon={<span className="w-2 h-2 rounded-full bg-accent3 flex-shrink-0 mt-1.5" />}
            />
          ))
        )}
      </SubSidebar>

      <ContentPane>
        <div className="flex justify-between items-center gap-3 mb-2.5">
          <div className="text-[12.5px] text-muted">
            {links.length} link{links.length === 1 ? "" : "s"}
          </div>
          <button onClick={exportFile} disabled={links.length === 0} className={ghostBtn}>
            Export .json
          </button>
        </div>

        {!active ? (
          <div className="bg-panel border border-border rounded-card px-4.5 pt-4.5 pb-4.5">
            <EmptyState text="No links yet — add your first one." />
          </div>
        ) : (
          <div className="bg-panel border border-border rounded-card px-4.5 pt-4.5 pb-4.5">
            <div className="flex justify-between items-start gap-3 mb-3">
              <div className="min-w-0">
                <div className="text-[17px] font-semibold break-words">{active.name}</div>
                <div className="text-[11px] text-muted mt-1">{active.date}</div>
              </div>
              <button
                onClick={() => removeLink(active.id)}
                className="flex-shrink-0 bg-transparent border border-border text-muted hover:text-red-400 hover:border-red-400/40 px-3 py-1.5 rounded-lg text-[13px]"
              >
                Delete
              </button>
            </div>

            <div className="text-[13.5px] mb-4">
              <a
                href={hrefOf(active.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent no-underline break-all"
              >
                {active.url}
              </a>
            </div>

            <a
              href={hrefOf(active.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-accent text-white px-3.5 py-2 rounded-lg text-[13.5px] font-medium hover:brightness-110"
            >
              Open link
            </a>
          </div>
        )}
      </ContentPane>

      <Modal open={open} title="New link" onClose={() => setOpen(false)}>
        <label className="block text-[12.5px] text-muted mt-2.5 mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. MDN Web Docs"
          className="w-full bg-bg border border-border text-text px-2.5 py-2 rounded-lg text-[13.5px]"
        />
        <label className="block text-[12.5px] text-muted mt-2.5 mb-1.5">URL</label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-bg border border-border text-text px-2.5 py-2 rounded-lg text-[13.5px]"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setOpen(false)}
            className="bg-transparent border border-border text-text px-3.5 py-2 rounded-lg text-[13.5px]"
          >
            Cancel
          </button>
          <button onClick={save} className="bg-accent text-white px-3.5 py-2 rounded-lg text-[13.5px] font-medium">
            Save link
          </button>
        </div>
      </Modal>
    </>
  );
}
