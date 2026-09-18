"use client";

import { useState } from "react";
import { useHubData } from "@/lib/useHubData";
import { EmptyState } from "@/components/ItemRow";
import Modal from "@/components/Modal";
import { SubSidebar, SubItem, SubAction, ContentPane } from "@/components/SubSidebar";

export default function NotesPage() {
  const { notes, addNote, removeNote } = useHubData();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("");
  const [activeId, setActiveId] = useState(null);

  const list = [...notes].reverse();
  // Falls back to the newest note, so deleting or adding never leaves the
  // detail pane pointing at something that no longer exists.
  const active = list.find((n) => n.id === activeId) || list[0] || null;

  function save() {
    if (!title.trim()) return;
    const created = addNote({ title, body, tag });
    if (created) setActiveId(created.id);
    setTitle("");
    setBody("");
    setTag("");
    setOpen(false);
  }

  return (
    <>
      <SubSidebar
        title="Notes"
        action={<SubAction onClick={() => setOpen(true)} title="New note">+</SubAction>}
      >
        {list.length === 0 ? (
          <div className="text-[12.5px] text-muted px-2.5 py-2">Nothing here yet.</div>
        ) : (
          list.map((n) => (
            <SubItem
              key={n.id}
              active={active?.id === n.id}
              onClick={() => setActiveId(n.id)}
              label={n.title}
              sub={n.tag || n.date}
              icon={<span className="w-2 h-2 rounded-full bg-accent2 flex-shrink-0 mt-1.5" />}
            />
          ))
        )}
      </SubSidebar>

      <ContentPane>
        {!active ? (
          <div className="bg-panel border border-border rounded-card px-4.5 pt-4.5 pb-4.5">
            <EmptyState text="No notes yet — add your first one." />
          </div>
        ) : (
          <div className="bg-panel border border-border rounded-card px-4.5 pt-4.5 pb-4.5">
            <div className="flex justify-between items-start gap-3 mb-3">
              <div className="min-w-0">
                <div className="text-[17px] font-semibold break-words">{active.title}</div>
                <div className="text-[11px] text-muted mt-1">
                  {active.date}
                  {active.tag && (
                    <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-panel2 text-muted ml-1.5 align-middle">
                      {active.tag}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeNote(active.id)}
                className="flex-shrink-0 bg-transparent border border-border text-muted hover:text-red-400 hover:border-red-400/40 px-3 py-1.5 rounded-lg text-[13px]"
              >
                Delete
              </button>
            </div>
            {active.body ? (
              <div className="text-[13.5px] text-muted whitespace-pre-wrap break-words">{active.body}</div>
            ) : (
              <div className="text-[13px] text-muted italic">This note has no content.</div>
            )}
          </div>
        )}
      </ContentPane>

      <Modal open={open} title="New note" onClose={() => setOpen(false)}>
        <label className="block text-[12.5px] text-muted mt-2.5 mb-1.5">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          className="w-full bg-bg border border-border text-text px-2.5 py-2 rounded-lg text-[13.5px]"
        />
        <label className="block text-[12.5px] text-muted mt-2.5 mb-1.5">Content</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write something..."
          className="w-full bg-bg border border-border text-text px-2.5 py-2 rounded-lg text-[13.5px] min-h-[80px] resize-y"
        />
        <label className="block text-[12.5px] text-muted mt-2.5 mb-1.5">Tag (optional)</label>
        <input
          type="text"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="e.g. cocos, sql, docker"
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
            Save note
          </button>
        </div>
      </Modal>
    </>
  );
}
