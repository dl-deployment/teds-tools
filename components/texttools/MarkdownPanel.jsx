"use client";

import { useMemo } from "react";
import { DropZone } from "@/components/assets/Shared";
import { renderMarkdown } from "@/lib/markdown";

const MD_FILE_RE = /\.(md|markdown|mdx|txt)$/i;

/**
 * The rendered HTML comes from `lib/markdown.js`, which can't carry class
 * names (Tailwind doesn't scan `lib/` — CLAUDE.md rule 4), so the tags are
 * styled here with child selectors on the wrapper instead.
 */
const PROSE_CLASS = [
  "text-[13.5px] leading-[1.7] text-text break-words",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_h1]:text-[21px] [&_h1]:font-semibold [&_h1]:mt-5 [&_h1]:mb-2.5 [&_h1]:pb-1.5 [&_h1]:border-b [&_h1]:border-border",
  "[&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:pb-1 [&_h2]:border-b [&_h2]:border-border",
  "[&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5",
  "[&_h4]:text-[13.5px] [&_h4]:font-semibold [&_h4]:mt-3.5 [&_h4]:mb-1",
  "[&_h5]:text-[12.5px] [&_h5]:font-semibold [&_h5]:mt-3 [&_h5]:mb-1 [&_h6]:text-[12.5px] [&_h6]:font-semibold [&_h6]:text-muted [&_h6]:mt-3 [&_h6]:mb-1",
  "[&_p]:my-2.5",
  "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:brightness-125",
  "[&_strong]:font-semibold [&_em]:italic [&_del]:text-muted [&_del]:line-through",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2.5",
  "[&_li]:my-1 [&_li>ul]:my-1 [&_li>ol]:my-1 [&_li_input]:mr-1.5 [&_li_input]:align-middle",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-accent/40 [&_blockquote]:pl-3 [&_blockquote]:my-3 [&_blockquote]:text-muted",
  "[&_hr]:border-border [&_hr]:my-4",
  "[&_code]:font-mono [&_code]:text-[12.5px] [&_code]:bg-panel2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded",
  "[&_pre]:bg-panel2 [&_pre]:border [&_pre]:border-border [&_pre]:rounded-lg [&_pre]:px-3 [&_pre]:py-2.5 [&_pre]:my-3",
  "[&_pre]:overflow-x-auto [&_pre]:font-mono [&_pre]:text-[12.5px] [&_pre]:leading-[1.55]",
  "[&_table]:w-full [&_table]:my-3 [&_table]:border-collapse [&_table]:text-[12.5px]",
  "[&_th]:border [&_th]:border-border [&_th]:bg-panel2 [&_th]:px-2 [&_th]:py-1 [&_th]:font-semibold",
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top",
  "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2",
].join(" ");

/**
 * MarkDown tab: the pane is either the drop zone (nothing loaded) or the
 * rendered file — never both, and never the source. Clear on the card empties
 * the buffer, which brings the drop zone back.
 */
export function MarkdownPanel({ text, setText, showToast }) {
  const html = useMemo(() => renderMarkdown(text), [text]);

  async function handleFiles(files) {
    const file = files?.[0];
    if (!file) return;
    if (!MD_FILE_RE.test(file.name)) {
      showToast("Drop a .md, .markdown or .txt file", "error");
      return;
    }
    try {
      setText(await file.text());
      showToast(`Loaded ${file.name}`);
    } catch {
      showToast("Could not read that file", "error");
    }
  }

  if (!html) {
    return (
      <DropZone
        onFiles={handleFiles}
        accept=".md,.markdown,.mdx,.txt,text/markdown,text/plain"
        className="min-h-[420px]"
      >
        <div className="text-[13px]">Drop a Markdown file here, or click to choose one</div>
        <div className="text-[11.5px] text-muted">.md, .markdown, .mdx, .txt</div>
      </DropZone>
    );
  }

  return (
    <div className="min-h-[420px] overflow-x-auto bg-bg border border-border rounded-lg px-4.5 py-4">
      <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
