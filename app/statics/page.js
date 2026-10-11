import path from "node:path";
import { ContentPane } from "@/components/SubSidebar";
import { EmptyState } from "@/components/ItemRow";
import { formatPageName, scanStaticPages } from "@/lib/staticPages";

export const metadata = {
  title: "Static Pages · Ted's Tools",
};

function staticPagesDir() {
  return path.join(process.cwd(), "public", "static_pages");
}

export default function StaticPagesPage() {
  const pages = scanStaticPages(staticPagesDir());

  return (
    <ContentPane>
      <div className="text-[15px] font-semibold mb-1">Static Pages</div>
      <div className="text-[12.5px] text-muted mb-4.5">
        Standalone pages dropped into <code>public/static_pages</code>.
      </div>

      {pages.length === 0 ? (
        <div className="bg-panel border border-border rounded-card px-4.5 pt-4.5 pb-4.5">
          <EmptyState text="No static pages found." />
        </div>
      ) : (
        <div className="grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
          {pages.map((page) => (
            <a
              key={page.href}
              href={page.href}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-panel border border-border rounded-card px-4.5 py-5 flex flex-col items-center gap-2 hover:border-accent3 hover:bg-panel2"
            >
              <span className="text-[26px] leading-none">{page.type === "folder" ? "📁" : "📄"}</span>
              <span className="text-sm font-semibold text-center break-words">{formatPageName(page.name)}</span>
              <span className="text-[11px] text-muted uppercase tracking-wide">
                {page.type === "folder" ? "Folder" : "HTML"}
              </span>
            </a>
          ))}
        </div>
      )}
    </ContentPane>
  );
}
