"use client";

import { useState } from "react";
import type { BrandMenuComparison, MenuItemFlag } from "@/lib/fleet";

const C = { swiggy: "#FC8019", zomato: "#E23744" };

type Props = { comparisons: BrandMenuComparison[] };

function ItemPill({ item, missingFrom }: { item: MenuItemFlag; missingFrom: "swiggy" | "zomato" }) {
  const label = missingFrom === "zomato" ? "Missing from Zomato" : "Missing from Swiggy";
  const color = missingFrom === "zomato" ? C.zomato : C.swiggy;
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-[10px] font-bold mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5"
        style={{ background: `${color}15`, color }}>
        {missingFrom === "zomato" ? "ZO" : "SW"}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-800">{item.name}</span>
        {item.category && (
          <span className="text-[10px] text-gray-400 ml-2">{item.category}</span>
        )}
      </div>
      <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">{label}</span>
    </div>
  );
}

const LEVEL_CHIP = {
  synced: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", label: "✓ Synced" },
  minor:  { bg: "#fffbeb", color: "#d97706", border: "#fde68a", label: "~ Minor drift" },
  major:  { bg: "#fff1f2", color: "#dc2626", border: "#fecaca", label: "⚠ Mismatch" },
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
    <div className="bg-white rounded-xl border overflow-hidden"
      style={{ borderColor: c.discrepancyLevel === "major" ? "#fca5a5" : c.discrepancyLevel === "minor" ? "#fde68a" : "#e5e7eb" }}>

      <button className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/50"
        style={{ background: c.discrepancyLevel === "major" ? "#fff8f8" : c.discrepancyLevel === "minor" ? "#fffef5" : "white" }}
        onClick={() => setOpen(v => !v)}>

        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900">{c.brand}</div>
          <div className="text-xs text-gray-400 mt-0.5">{c.location} · {c.city}</div>
        </div>

        {/* Counts */}
        <div className="flex items-center gap-3 text-xs">
          <div className="text-center">
            <div className="font-bold text-gray-700">{c.inBoth}</div>
            <div className="text-[10px] text-gray-400">In both</div>
          </div>
          <div className="w-px h-8 bg-gray-100" />
          <div className="text-center">
            <div className="font-bold" style={{ color: missingZomatoCount > 0 ? C.zomato : "#16a34a" }}>
              {missingZomatoCount}
            </div>
            <div className="text-[10px] text-gray-400">Missing Zomato</div>
          </div>
          <div className="text-center">
            <div className="font-bold" style={{ color: missingSwiggyCount > 0 ? C.swiggy : "#16a34a" }}>
              {missingSwiggyCount}
            </div>
            <div className="text-[10px] text-gray-400">Missing Swiggy</div>
          </div>
          {countDiff > 0 && (
            <div className="text-center">
              <div className="font-bold text-gray-500">{diffPct}%</div>
              <div className="text-[10px] text-gray-400">Count diff</div>
            </div>
          )}
        </div>

        {/* Status chip */}
        <div className="ml-2">
          <span className="text-[11px] font-semibold rounded-full px-2.5 py-1"
            style={{ background: chip.bg, color: chip.color, border: `1px solid ${chip.border}` }}>
            {chip.label}
          </span>
        </div>
      </button>

      {open && c.hasDiscrepancy && (
        <div className="border-t border-gray-100">
          {/* Platform totals bar */}
          <div className="flex items-center gap-6 px-5 py-2.5 bg-gray-50 border-b border-gray-100">
            <span className="text-[11px] font-bold" style={{ color: C.swiggy }}>
              Swiggy: {c.swiggyTotal} items
            </span>
            <span className="text-[11px] font-bold" style={{ color: C.zomato }}>
              Zomato: {c.zomatoTotal} items
            </span>
            <span className="text-[11px] text-gray-400">
              {c.inBoth} items match · {missingZomatoCount + missingSwiggyCount} discrepancies
            </span>
            <div className="ml-auto text-[10px] text-gray-400 italic">
              Recommended/Bestseller categories excluded
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex border-b border-gray-100">
            <button
              className="px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors"
              style={{
                borderColor: tab === "zomato" ? C.zomato : "transparent",
                color: tab === "zomato" ? C.zomato : "#6b7280",
              }}
              onClick={() => setTab("zomato")}
            >
              On Swiggy, missing from Zomato ({missingZomatoCount})
            </button>
            <button
              className="px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors"
              style={{
                borderColor: tab === "swiggy" ? C.swiggy : "transparent",
                color: tab === "swiggy" ? C.swiggy : "#6b7280",
              }}
              onClick={() => setTab("swiggy")}
            >
              On Zomato, missing from Swiggy ({missingSwiggyCount})
            </button>
          </div>

          {/* Items list */}
          <div className="px-5 py-2 max-h-64 overflow-y-auto">
            {currentItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">
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
        <div className="border-t border-gray-100 px-5 py-4 bg-green-50/30">
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <span style={{ color: C.swiggy }} className="font-medium">Swiggy: {c.swiggyTotal} items</span>
            <span style={{ color: C.zomato }} className="font-medium">Zomato: {c.zomatoTotal} items</span>
            <span className="text-green-600 font-medium">✓ All {c.inBoth} fixed-menu items match</span>
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
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Menu Check</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Fixed menu items compared across Swiggy and Zomato · Recommended categories excluded
            </p>
          </div>
          <div className="text-xs text-gray-400">Refreshes every 30 min</div>
        </div>

        {/* KPIs */}
        <div className="flex items-center gap-4 mt-4">
          {majorCount > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
              <div className="text-xl font-bold text-red-700 leading-none">{majorCount}</div>
              <div className="text-[10px] text-red-600 mt-0.5">Major mismatch</div>
            </div>
          )}
          {minorCount > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5">
              <div className="text-xl font-bold text-amber-700 leading-none">{minorCount}</div>
              <div className="text-[10px] text-amber-600 mt-0.5">Minor drift</div>
            </div>
          )}
          <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-2.5">
            <div className="text-xl font-bold text-green-700 leading-none">{syncedCount}</div>
            <div className="text-[10px] text-green-600 mt-0.5">Synced</div>
          </div>
          {totalFlags > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
              <div className="text-xl font-bold text-gray-600 leading-none">{totalFlags}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Total item gaps</div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border-b border-gray-200 px-8 py-3 flex items-center gap-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["issues", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                background: filter === f ? "white" : "transparent",
                color: filter === f ? "#111827" : "#6b7280",
                boxShadow: filter === f ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
              }}>
              {f === "issues" ? `Issues only (${majorCount + minorCount})` : `All brands (${comparisons.length})`}
            </button>
          ))}
        </div>
        <input
          placeholder="Search brand..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400 w-48"
        />
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} brands shown</span>
      </div>

      {/* Brand cards */}
      <main className="flex-1 px-8 py-6 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 text-gray-300">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
            </svg>
            <p className="text-sm">{filter === "issues" ? "No menu issues found" : "No brands found"}</p>
            {filter === "issues" && <p className="text-xs mt-1 text-gray-300">All fixed menus are in sync across platforms</p>}
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
