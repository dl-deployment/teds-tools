"use client";

export function NoteRow({ note, onDelete }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-none">
      <div className="w-2 h-2 rounded-full bg-accent2 mt-1.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{note.title}</div>
        {note.body && <div className="text-[12.5px] text-muted mt-0.5 whitespace-pre-wrap break-words">{note.body}</div>}
        <div className="text-[11px] text-muted mt-1">
          {note.date}
          {note.tag && (
            <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-panel2 text-muted ml-1.5 align-middle">
              {note.tag}
            </span>
          )}
        </div>
      </div>
      <div
        className="text-muted hover:text-red-400 hover:bg-red-400/10 cursor-pointer text-base leading-none px-1.5 py-0.5 rounded-md flex-shrink-0"
        onClick={() => onDelete(note.id)}
      >
        ×
      </div>
    </div>
  );
}

export function LinkRow({ link, onDelete }) {
  const href = /^https?:\/\//i.test(link.url) ? link.url : `https://${link.url}`;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-none">
      <div className="w-2 h-2 rounded-full bg-accent3 mt-1.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{link.name}</div>
        <div className="text-[12.5px] mt-0.5">
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent no-underline break-all">
            {link.url}
          </a>
        </div>
        <div className="text-[11px] text-muted mt-1">{link.date}</div>
      </div>
      <div
        className="text-muted hover:text-red-400 hover:bg-red-400/10 cursor-pointer text-base leading-none px-1.5 py-0.5 rounded-md flex-shrink-0"
        onClick={() => onDelete(link.id)}
      >
        ×
      </div>
    </div>
  );
}

export function EmptyState({ text }) {
  return <div className="text-muted text-[13px] py-5 text-center">{text}</div>;
}
