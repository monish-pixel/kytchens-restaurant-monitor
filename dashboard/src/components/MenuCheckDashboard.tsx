"use client";

import { useState } from "react";
import type { BrandMenuComparison, MenuItemFlag } from "@/lib/fleet";

const C = { swiggy: "#FC8019", zomato: "#E23744" };

type Props = { comparisons: BrandMenuComparison[] };

function ItemPill({ item, missingFrom }: { item: MenuItemFlag; missingFrom: "swiggy" | "zomato" }) {
  const color = missingFrom === "zomato" ? C.zomato : C.swiggy;
  const label = missingFrom === "zomato" ? "Missing from Zomato" : "Missing from Swiggy";
  return (
    <div className="flex items-start gap-2 py-1.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
      <span
        className="text-[10px] font-bold mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5"
        style={{ background: `${color}18`, color }}
      >
        {missingFrom === "zomato" ? "ZO" : "SW"}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm" style={{ color: "var(--ink)" }}>{item.name}</span>
        {item.category && (
          <span className="text-[10px] ml-2" style={{ color: "var(--ink-4)" }}>{item.category}</span>
        )}
      </div>
      <span className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: "var(--ink-4)" }}>{label}</span>
    </div>
  );
}

const LEVEL_CHIP = {
  synced: { bg: "#F0FDF4", color: "#16a34a", border: "#BBF7D0", label: "✓ Synced" },
  minor:  { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A", label: "~ Minor drift" },
  major:  { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA", label: "⚠ Mismatch" },
};

const LEVEL_CARD_BORDER = {
  synced: "var(--border)",
  minor:  "#FDE68A",
  major:  "#FECACA",
};

const LEVEL_CARD_BG = {
  synced: "var(--surface)",
  minor:  "#FFFEF8",
  major:  "#FFF9F9",
};

function BrandCard({ c, defaultOpen }: { c: BrandMenuComparison; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<"zomato" | "swiggy">("zomato");

  const missingZomatoCount = c.missingFromZomato.length;
  const missingSwiggyCount = c.missingFromSwiggy.length;
  const currentItems = tab === "zomato" ? c.missingFromZomato : c.missingFromSwiggy;

  const chip = LEVEL_CHIP[c.discrepancyLevel];
  const countDiff = Math.abs(c.swiggyTotal - c.zomatoTotal);
  const diffPct = Math.max(c.swiggyTotal, c.zomatoTotal) > 0
    ? Math.round((countDiff / Math.max(c.swiggyTotal, c.zomatoTotal)) * 100)
    : 0;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${LEVEL_CARD_BORDER[c.discrepancyLevel]}`,
        background: LEVEL_CARD_BG[c.discrepancyLevel],
        boxShadow: "0 1px 3px rgba(28,25,23,0.04)",
      }}
    >
      <button
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
        style={{ background: LEVEL_CARD_BG[c.discrepancyLevel] }}
        onClick={() => setOpen(v => !v)}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.5"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{c.brand}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--ink-4)" }}>{c.location} · {c.city}</div>
        </div>

        {/* Counts */}
        <div className="flex items-center gap-3 text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
          <div className="text-center">
            <div className="font-bold" style={{ color: "var(--ink)" }}>{c.inBoth}</div>
            <div className="text-[10px]" style={{ color: "var(--ink-4)" }}>In both</div>
          </div>
          <div className="w-px h-8" style={{ background: "var(--border)" }} />
          <div className="text-center">
            <div className="font-bold" style={{ color: missingZomatoCount > 0 ? C.zomato : "#16a34a" }}>
              {missingZomatoCount}
            </div>
            <div className="text-[10px]" style={{ color: "var(--ink-4)" }}>Miss. Zomato</div>
          </div>
          <div className="text-center">
            <div className="font-bold" style={{ color: missingSwiggyCount > 0 ? C.swiggy : "#16a34a" }}>
              {missingSwiggyCount}
            </div>
            <div className="text-[10px]" style={{ color: "var(--ink-4)" }}>Miss. Swiggy</div>
          </div>
          {countDiff > 0 && (
            <div className="text-center">
              <div className="font-bold" style={{ color: "var(--ink-3)" }}>{diffPct}%</div>
              <div className="text-[10px]" style={{ color: "var(--ink-4)" }}>Count diff</div>
            </div>
          )}
        </div>

        {/* Status chip */}
        <div className="ml-2 flex-shrink-0">
          <span
            className="text-[11px] font-semibold rounded-full px-2.5 py-1"
            style={{ background: chip.bg, color: chip.color, border: `1px solid ${chip.border}` }}
          >
            {chip.label}
          </span>
        </div>
      </button>

      {open && c.hasDiscrepancy && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {/* Platform totals bar */}
          <div
            className="flex items-center gap-6 px-5 py-2.5 border-b"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
          >
            <span className="text-[11px] font-bold" style={{ color: C.swiggy }}>
              Swiggy: {c.swiggyTotal} items
            </span>
            <span className="text-[11px] font-bold" style={{ color: C.zomato }}>
              Zomato: {c.zomatoTotal} items
            </span>
            <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>
              {c.inBoth} match · {missingZomatoCount + missingSwiggyCount} discrepancies
            </span>
            <div className="ml-auto text-[10px] italic" style={{ color: "var(--ink-4)" }}>
              Recommended/Bestseller excluded
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
            <button
              className="px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors"
              style={{
                borderColor: tab === "zomato" ? C.zomato : "transparent",
                color: tab === "zomato" ? C.zomato : "var(--ink-3)",
              }}
              onClick={() => setTab("zomato")}
            >
              On Swiggy, missing from Zomato ({missingZomatoCount})
            </button>
            <button
              className="px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors"
              style={{
                borderColor: tab === "swiggy" ? C.swiggy : "transparent",
                color: tab === "swiggy" ? C.swiggy : "var(--ink-3)",
              }}
              onClick={() => setTab("swiggy")}
            >
              On Zomato, missing from Swiggy ({missingSwiggyCount})
            </button>
          </div>

          {/* Items list */}
          <div className="px-5 py-2 max-h-64 overflow-y-auto">
            {currentItems.length === 0 ? (
              <div className="py-6 text-center text-sm" style={{ color: "var(--ink-4)" }}>
                No items missing from {tab === "zomato" ? "Zomato" : "Swiggy"}
              </div>
            ) : (
              currentItems.map((item, i) => (
                <ItemPill key={i} item={item} missingFrom={tab} />
              ))
            )}
          </div>
        </div>
      )}

      {open && !c.hasDiscrepancy && (
        <div className="border-t px-5 py-4" style={{ borderColor: "var(--border)", background: "#F0FDF480" }}>
          <div className="flex items-center gap-6 text-xs" style={{ color: "var(--ink-3)" }}>
            <span style={{ color: C.swiggy }} className="font-medium">Swiggy: {c.swiggyTotal} items</span>
            <span style={{ color: C.zomato }} className="font-medium">Zomato: {c.zomatoTotal} items</span>
            <span className="font-medium" style={{ color: "#16a34a" }}>✓ All {c.inBoth} fixed-menu items match</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MenuCheckDashboard({ comparisons }: Props) {
  const [filter, setFilter] = useState<"all" | "issues">("issues");
  const [search, setSearch] = useState("");

  const majorCount = comparisons.filter(c => c.discrepancyLevel === "major").length;
  const minorCount = comparisons.filter(c => c.discrepancyLevel === "minor").length;
  const syncedCount = comparisons.filter(c => c.discrepancyLevel === "synced").length;
  const totalFlags = comparisons.reduce((s, c) => s + c.missingFromZomato.length + c.missingFromSwiggy.length, 0);

  const filtered = comparisons
    .filter(c => filter === "all" || c.hasDiscrepancy)
    .filter(c => !search || c.brand.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--canvas)" }}>
      {/* Header */}
      <div
        className="px-8 py-5"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold" style={{ color: "var(--ink)" }}>Menu Check</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-4)" }}>
              Fixed menu items compared across Swiggy and Zomato · Recommended categories excluded
            </p>
          </div>
          <div className="text-xs" style={{ color: "var(--ink-4)" }}>Refreshes every 30 min</div>
        </div>

        {/* KPIs */}
        <div className="flex items-center gap-3 mt-4">
          {majorCount > 0 && (
            <div className="rounded-lg px-4 py-2.5" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
              <div className="text-xl font-bold leading-none" style={{ color: "#DC2626", fontVariantNumeric: "tabular-nums" }}>{majorCount}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "#DC262699" }}>Major mismatch</div>
            </div>
          )}
          {minorCount > 0 && (
            <div className="rounded-lg px-4 py-2.5" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
              <div className="text-xl font-bold leading-none" style={{ color: "#D97706", fontVariantNumeric: "tabular-nums" }}>{minorCount}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "#D9770699" }}>Minor drift</div>
            </div>
          )}
          <div className="rounded-lg px-4 py-2.5" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
            <div className="text-xl font-bold leading-none" style={{ color: "#16a34a", fontVariantNumeric: "tabular-nums" }}>{syncedCount}</div>
            <div className="text-[10px] mt-0.5" style={{ color: "#16a34a99" }}>Synced</div>
          </div>
          {totalFlags > 0 && (
            <div className="rounded-lg px-4 py-2.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div className="text-xl font-bold leading-none" style={{ color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{totalFlags}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--ink-4)" }}>Total item gaps</div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div
        className="px-8 py-3 flex items-center gap-4"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--surface-2)" }}>
          {(["issues", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                background: filter === f ? "var(--surface)" : "transparent",
                color: filter === f ? "var(--ink)" : "var(--ink-3)",
                boxShadow: filter === f ? "0 1px 2px rgba(28,25,23,0.08)" : "none",
              }}>
              {f === "issues" ? `Issues only (${majorCount + minorCount})` : `All brands (${comparisons.length})`}
            </button>
          ))}
        </div>
        <input
          placeholder="Search brand…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-lg px-3 py-1.5 text-sm outline-none w-48 transition-colors"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--ink)",
          }}
        />
        <span className="text-xs ml-auto" style={{ color: "var(--ink-4)" }}>{filtered.length} brands shown</span>
      </div>

      {/* Brand cards */}
      <main className="flex-1 px-8 py-6 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64" style={{ color: "var(--ink-4)" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-30">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
            </svg>
            <p className="text-sm">{filter === "issues" ? "No menu issues found" : "No brands found"}</p>
            {filter === "issues" && <p className="text-xs mt-1 opacity-60">All fixed menus are in sync across platforms</p>}
          </div>
        ) : (
          filtered.map(c => (
            <BrandCard key={c.restaurantId} c={c} defaultOpen={c.hasDiscrepancy && filtered.length <= 5} />
          ))
        )}
      </main>
    </div>
  );
}
