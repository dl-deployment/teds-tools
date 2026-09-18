"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/tools", label: "Tools", icon: "⚙" },
  { href: "/texttools", label: "Text Tools", icon: "✎" },
  { href: "/color", label: "Color Tools", icon: "◐" },
  { href: "/assets", label: "Assets Tools", icon: "◈" },
  { href: "/notes", label: "Notes", icon: "▤" },
  { href: "/links", label: "Links", icon: "⛓" },
  { href: "/statics", label: "Static Pages", icon: "▦" },
  { href: "/poe", label: "POE Tools", icon: "⬡" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-shrink-0 flex-col bg-panel border-r border-border transition-all duration-150 ${
        collapsed ? "w-16 px-2.5" : "w-36 px-3"
      } py-5`}
    >
      <div className={`flex items-center gap-2 pb-5 px-2 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-7 h-7 rounded-[9px] bg-gradient-to-br from-accent to-accent3 flex-shrink-0" />
        {!collapsed && (
          <div className="min-w-0 truncate font-semibold text-sm leading-tight">Ted&apos;s Hub</div>
        )}
      </div>

      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-2 py-2 rounded-[9px] text-[13px] border ${
                collapsed ? "justify-center" : ""
              } ${
                active
                  ? "bg-accent/[0.14] border-accent/30 text-text"
                  : "border-transparent text-muted hover:text-text hover:bg-panel2"
              }`}
            >
              <span className="w-[18px] text-center flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="min-w-0 truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <button
        onClick={() => setCollapsed((v) => !v)}
        title="Toggle sidebar"
        className="w-full h-9 rounded-[9px] bg-panel2 border border-border text-muted hover:text-text hover:border-accent flex items-center justify-center text-[15px]"
      >
        ☰
      </button>
    </aside>
  );
}
