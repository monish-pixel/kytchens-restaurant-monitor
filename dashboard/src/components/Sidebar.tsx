"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    label: "Store Live",
    href: "/",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    label: "Menu Check",
    href: "/menu-check",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    ),
  },
  {
    label: "Reports",
    href: "/reports",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-56 shrink-0 flex flex-col min-h-screen"
      style={{
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Brand */}
      <div className="px-4 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--brand)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2" />
              <path d="M12 8v4l3 3" />
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-bold leading-tight" style={{ color: "var(--ink)" }}>
              Kytchens
            </div>
            <div className="text-[10px] leading-tight" style={{ color: "var(--ink-4)" }}>
              Fleet Monitor
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4">
        <div
          className="text-[10px] px-2 mb-2.5 tracking-widest uppercase font-semibold"
          style={{ color: "var(--ink-4)" }}
        >
          Overview
        </div>
        <div className="space-y-0.5">
          {NAV.map(({ label, href, icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors relative"
                style={{
                  background: active ? "var(--brand-bg)" : "transparent",
                  color: active ? "var(--brand)" : "var(--ink-3)",
                  borderLeft: active ? "2px solid var(--brand)" : "2px solid transparent",
                }}
              >
                <span style={{ color: active ? "var(--brand)" : "var(--ink-4)" }}>
                  {icon}
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div
        className="px-4 py-4"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="text-[10px]" style={{ color: "var(--ink-4)" }}>
          Swiggy · Zomato
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          <span className="text-[10px]" style={{ color: "var(--ink-3)" }}>Monitoring live</span>
        </div>
      </div>
    </aside>
  );
}
