"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { format } from "date-fns";
import type { DowntimeRecord, UptimeSummary } from "@/app/reports/page";
import { isWithinStoreHours, nowIST, istDayStart, istMonthStart, IST_OFFSET_MS } from "@/lib/store-hours";

// ── Preset types ──────────────────────────────────────────────────────────────

type Preset = "today" | "yesterday" | "mtd" | "thisMonth" | "lastMonth" | "last30" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today",     label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "mtd",       label: "MTD" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "last30",    label: "Last 30 days" },
  { id: "custom",    label: "Custom" },
];

// ── Date helpers ──────────────────────────────────────────────────────────────

function getPresetRange(p: Preset, from?: Date | null, to?: Date | null): { from: Date; to: Date } {
  const ist = nowIST();
  const now = new Date();
  switch (p) {
    case "today":     return { from: istDayStart(ist, 0), to: now };
    case "yesterday": return { from: istDayStart(ist, -1), to: istDayStart(ist, 0) };
    case "mtd":       return { from: istMonthStart(ist, 0), to: now };
    case "thisMonth": return { from: istMonthStart(ist, 0), to: istMonthStart(ist, 1) };
    case "lastMonth": return { from: istMonthStart(ist, -1), to: istMonthStart(ist, 0) };
    case "last30":    return { from: istDayStart(ist, -30), to: now };
    case "custom":    return { from: from ?? istDayStart(ist, 0), to: to ?? now };
  }
}

function presetButtonLabel(p: Preset, from: Date | null, to: Date | null): string {
  if (p === "custom" && from) {
    const fmtIST = (d: Date) => format(new Date(d.getTime() + IST_OFFSET_MS), "dd MMM");
    return `${fmtIST(from)} – ${to ? fmtIST(to) : "…"}`;
  }
  return PRESETS.find(x => x.id === p)?.label ?? "Date";
}

function fmtDuration(mins: number | null): string {
  if (mins === null) return "Ongoing";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
}

// ── Summary recomputation ─────────────────────────────────────────────────────

function computeSummaries(filtered: DowntimeRecord[]): UptimeSummary[] {
  const map = new Map<string, UptimeSummary>();
  for (const d of filtered) {
    const key = `${d.brand}:${d.location}:${d.platform}`;
    if (!map.has(key)) {
      map.set(key, {
        brand: d.brand, location: d.location, city: d.city, platform: d.platform,
        total_incidents: 0, total_downtime_minutes: 0, longest_downtime_minutes: 0,
      });
    }
    const s = map.get(key)!;
    s.total_incidents++;
    if (d.duration_minutes !== null) {
      s.total_downtime_minutes += d.duration_minutes;
      s.longest_downtime_minutes = Math.max(s.longest_downtime_minutes, d.duration_minutes);
    }
  }
  return [...map.values()].sort((a, b) => b.total_downtime_minutes - a.total_downtime_minutes);
}

// ── Mini calendar ─────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_ABBR = ["S","M","T","W","T","F","S"];

function Calendar({
  viewDate, onViewChange, selFrom, selTo, onDayClick,
}: {
  viewDate: Date;
  onViewChange: (d: Date) => void;
  selFrom: Date | null;
  selTo: Date | null;
  onDayClick: (utcDate: Date) => void;
}) {
  const ist = new Date(viewDate.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth();
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayIST = nowIST();
  const todayY = todayIST.getUTCFullYear(), todayM = todayIST.getUTCMonth(), todayD = todayIST.getUTCDate();

  function cellUTC(d: number) { return new Date(Date.UTC(year, month, d) - IST_OFFSET_MS); }

  function dayState(d: number): "from" | "to" | "in-range" | "today" | "normal" {
    const utc = cellUTC(d);
    if (selFrom && selTo && utc > selFrom && utc < selTo) return "in-range";
    if (selFrom) {
      const fromIST = new Date(selFrom.getTime() + IST_OFFSET_MS);
      if (fromIST.getUTCFullYear() === year && fromIST.getUTCMonth() === month && fromIST.getUTCDate() === d) return "from";
    }
    if (selTo) {
      const toIST = new Date(selTo.getTime() + IST_OFFSET_MS);
      if (toIST.getUTCFullYear() === year && toIST.getUTCMonth() === month && toIST.getUTCDate() === d) return "to";
    }
    if (year === todayY && month === todayM && d === todayD) return "today";
    return "normal";
  }

  return (
    <div style={{ width: 256 }}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => onViewChange(new Date(Date.UTC(year, month - 1, 1) - IST_OFFSET_MS))}
          className="w-7 h-7 rounded flex items-center justify-center text-sm transition-colors hover:bg-black/5">
          ‹
        </button>
        <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          {MONTH_NAMES[month]} {year}
        </span>
        <button onClick={() => onViewChange(new Date(Date.UTC(year, month + 1, 1) - IST_OFFSET_MS))}
          className="w-7 h-7 rounded flex items-center justify-center text-sm transition-colors hover:bg-black/5">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_ABBR.map((h, i) => (
          <div key={i} className="text-center text-[10px] font-medium py-1" style={{ color: "var(--ink-4)" }}>{h}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const state = dayState(d);
          const isEndpoint = state === "from" || state === "to";
          return (
            <div key={i} className="flex items-center justify-center"
              style={{ background: state === "in-range" ? "rgba(249,115,22,0.12)" : "transparent" }}>
              <button
                onClick={() => onDayClick(cellUTC(d))}
                className="w-8 h-8 rounded-full text-[12px] flex items-center justify-center transition-colors"
                style={{
                  background: isEndpoint ? "var(--brand)" : "transparent",
                  color: isEndpoint ? "#fff" : state === "today" ? "var(--brand)" : "var(--ink)",
                  border: state === "today" && !isEndpoint ? "1.5px solid var(--brand)" : "1.5px solid transparent",
                  fontWeight: isEndpoint || state === "today" ? 600 : 400,
                }}
              >
                {d}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DatePicker dropdown ────────────────────────────────────────────────────────

function DatePicker({ preset, customFrom, customTo, onApply }: {
  preset: Preset;
  customFrom: Date | null;
  customTo: Date | null;
  onApply: (p: Preset, from?: Date, to?: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<Preset>(preset);
  const [pendingFrom, setPendingFrom] = useState<Date | null>(customFrom);
  const [pendingTo, setPendingTo]     = useState<Date | null>(customTo);
  const [pickStep, setPickStep]       = useState<"from" | "to">("from");
  const [viewDate, setViewDate]       = useState(new Date());
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, [open]);

  function handlePresetClick(p: Preset) {
    if (p !== "custom") {
      onApply(p);
      setOpen(false);
      return;
    }
    setPendingPreset("custom");
    setPendingFrom(null);
    setPendingTo(null);
    setPickStep("from");
  }

  function handleDayClick(utc: Date) {
    if (pendingPreset !== "custom") {
      setPendingPreset("custom");
      setPendingFrom(null);
      setPendingTo(null);
    }
    if (pickStep === "from") {
      setPendingFrom(utc);
      setPendingTo(null);
      setPickStep("to");
    } else {
      if (pendingFrom && utc < pendingFrom) {
        setPendingFrom(utc);
        setPendingTo(null);
        setPickStep("to");
      } else {
        setPendingTo(utc);
        setPickStep("from");
      }
    }
  }

  function handleDone() {
    if (pendingPreset !== "custom") {
      onApply(pendingPreset);
    } else if (pendingFrom && pendingTo) {
      onApply("custom", pendingFrom, pendingTo);
    }
    setOpen(false);
  }

  // What to highlight in the calendar
  const calRange = pendingPreset !== "custom"
    ? getPresetRange(pendingPreset)
    : { from: pendingFrom, to: pendingTo };

  const label = presetButtonLabel(preset, customFrom, customTo);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{
          border: `1.5px solid ${open ? "var(--brand)" : "var(--border)"}`,
          background: "var(--surface)",
          color: "var(--ink)",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity={0.5}>
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" opacity={0.4}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-1.5 z-50 flex rounded-2xl overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 12px 32px rgba(28,25,23,0.12), 0 2px 8px rgba(28,25,23,0.06)",
            minWidth: 460,
          }}
        >
          {/* Left: presets */}
          <div className="w-40 py-2" style={{ borderRight: "1px solid var(--border)" }}>
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => handlePresetClick(p.id)}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                style={{
                  background: pendingPreset === p.id ? "rgba(249,115,22,0.08)" : "transparent",
                  color: pendingPreset === p.id ? "var(--brand)" : "var(--ink-2)",
                  fontWeight: pendingPreset === p.id ? 600 : 400,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Right: calendar */}
          <div className="flex-1 px-5 py-4 flex flex-col">
            <Calendar
              viewDate={viewDate}
              onViewChange={setViewDate}
              selFrom={calRange.from instanceof Date ? calRange.from : null}
              selTo={calRange.to instanceof Date ? calRange.to : null}
              onDayClick={handleDayClick}
            />
            <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--ink-4)" }}>
                {pendingPreset === "custom"
                  ? pendingFrom && !pendingTo
                    ? `From ${format(new Date(pendingFrom.getTime() + IST_OFFSET_MS), "dd MMM")} — pick end date`
                    : !pendingFrom
                      ? "Pick a start date"
                      : `${format(new Date(pendingFrom.getTime() + IST_OFFSET_MS), "dd MMM")} – ${format(new Date(pendingTo!.getTime() + IST_OFFSET_MS), "dd MMM")}`
                  : ""}
              </span>
              <button
                onClick={handleDone}
                className="text-sm font-semibold px-3 py-1 rounded-lg transition-colors hover:bg-orange-50"
                style={{ color: "var(--brand)" }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const C = { swiggy: "#FC8019", zomato: "#E23744" };

type Props = {
  downtimes: DowntimeRecord[];
  summaries: UptimeSummary[];
};

export default function ReportsDashboard({ downtimes }: Props) {
  const [tab, setTab]                 = useState<"summary" | "log">("summary");
  const [platform, setPlatform]       = useState<"all" | "swiggy" | "zomato">("all");
  const [preset, setPreset]           = useState<Preset>("today");
  const [customFrom, setCustomFrom]   = useState<Date | null>(null);
  const [customTo, setCustomTo]       = useState<Date | null>(null);

  const range = useMemo(
    () => getPresetRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const filtered = useMemo(() => {
    const from = range.from.toISOString();
    const to   = range.to.toISOString();
    return downtimes
      .filter(d => d.went_offline >= from && d.went_offline <= to)
      .filter(d => isWithinStoreHours(d.location_slug, new Date(d.went_offline)))
      .filter(d => platform === "all" || d.platform === platform);
  }, [downtimes, range, platform]);

  const summaries = useMemo(() => computeSummaries(filtered), [filtered]);

  const totalIncidents   = filtered.length;
  const totalDowntime    = filtered.reduce((s, d) => s + (d.duration_minutes ?? 0), 0);
  const ongoingCount     = filtered.filter(d => d.came_online === null).length;

  function handleApply(p: Preset, from?: Date, to?: Date) {
    setPreset(p);
    setCustomFrom(p === "custom" ? (from ?? null) : null);
    setCustomTo(p === "custom" ? (to ?? null) : null);
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--canvas)" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="px-8 pt-5 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-base font-bold" style={{ color: "var(--ink)" }}>Reports</h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-4)" }}>
                Downtime during operational hours · Pune
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2.5">
              <DatePicker
                preset={preset}
                customFrom={customFrom}
                customTo={customTo}
                onApply={handleApply}
              />

              {/* Platform pills */}
              <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {(["all", "swiggy", "zomato"] as const).map((p, i) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className="px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      background: platform === p
                        ? (p === "swiggy" ? "#FFF4EC" : p === "zomato" ? "#FFF1F2" : "rgba(249,115,22,0.08)")
                        : "transparent",
                      color: platform === p
                        ? (p === "swiggy" ? C.swiggy : p === "zomato" ? C.zomato : "var(--brand)")
                        : "var(--ink-3)",
                      borderRight: i < 2 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="flex items-center gap-2.5 mt-4">
            <div className="flex items-center gap-3 rounded-lg px-4 py-2.5"
              style={{ background: totalIncidents > 0 ? "#FEF2F2" : "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div>
                <div className="text-xl font-bold leading-none tabular-nums"
                  style={{ color: totalIncidents > 0 ? "#dc2626" : "var(--ink-3)" }}>
                  {totalIncidents}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: totalIncidents > 0 ? "#dc262699" : "var(--ink-4)" }}>
                  Incidents
                </div>
              </div>
            </div>

            {totalIncidents > 0 && (
              <>
                <div className="rounded-lg px-4 py-2.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <div className="text-xl font-bold leading-none tabular-nums" style={{ color: "var(--ink-2)" }}>
                    {fmtDuration(totalDowntime)}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--ink-4)" }}>Total downtime</div>
                </div>

                {ongoingCount > 0 && (
                  <div className="rounded-lg px-4 py-2.5" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                    <div className="text-xl font-bold leading-none tabular-nums" style={{ color: "#D97706" }}>
                      {ongoingCount}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: "#D97706" }}>Still offline</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-8">
          {(["summary", "log"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderColor: tab === t ? "var(--brand)" : "transparent",
                color: tab === t ? "var(--brand)" : "var(--ink-3)",
              }}
            >
              {t === "summary" ? "Summary" : "Incident Log"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="flex-1 px-8 py-6">
        {tab === "summary" ? (
          summaries.length === 0 ? <EmptyState /> : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
              <div
                className="grid gap-4 px-5 py-2.5"
                style={{ gridTemplateColumns: "1fr 110px 80px 100px 100px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}
              >
                {["Brand / Location", "Platform", "Incidents", "Total Down", "Longest"].map(h => (
                  <div key={h} className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--ink-4)" }}>{h}</div>
                ))}
              </div>
              {summaries.map((s, i) => (
                <div key={i} className="grid gap-4 px-5 py-3 border-t items-center"
                  style={{ gridTemplateColumns: "1fr 110px 80px 100px 100px", borderColor: "var(--border)" }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{s.brand}</div>
                    <div className="text-[11px]" style={{ color: "var(--ink-4)" }}>{s.location}</div>
                  </div>
                  <PlatformBadge platform={s.platform} />
                  <div className="text-sm font-semibold tabular-nums" style={{ color: "var(--ink)" }}>{s.total_incidents}</div>
                  <DurationCell mins={s.total_downtime_minutes} />
                  <DurationCell mins={s.longest_downtime_minutes} dimmed />
                </div>
              ))}
            </div>
          )
        ) : (
          filtered.length === 0 ? <EmptyState /> : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
              <div
                className="grid gap-4 px-5 py-2.5"
                style={{ gridTemplateColumns: "160px 1fr 110px 100px 80px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}
              >
                {["Time (IST)", "Brand / Location", "Platform", "Duration", "Status"].map(h => (
                  <div key={h} className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--ink-4)" }}>{h}</div>
                ))}
              </div>
              {[...filtered]
                .sort((a, b) => b.went_offline.localeCompare(a.went_offline))
                .slice(0, 300)
                .map((d, i) => {
                  const offlineIST = new Date(new Date(d.went_offline).getTime() + IST_OFFSET_MS);
                  const onlineIST  = d.came_online ? new Date(new Date(d.came_online).getTime() + IST_OFFSET_MS) : null;
                  return (
                    <div key={i}
                      className="grid gap-4 px-5 py-3 border-t items-center"
                      style={{
                        gridTemplateColumns: "160px 1fr 110px 100px 80px",
                        borderColor: "var(--border)",
                        background: d.came_online === null ? "#FFF8F8" : "transparent",
                      }}
                    >
                      <div>
                        <div className="text-[12px] font-medium tabular-nums" style={{ color: "var(--ink-2)" }}>
                          {format(offlineIST, "dd MMM, hh:mm a")}
                        </div>
                        {onlineIST && (
                          <div className="text-[10px] tabular-nums" style={{ color: "var(--ink-4)" }}>
                            → {format(onlineIST, "hh:mm a")}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{d.brand}</div>
                        <div className="text-[11px]" style={{ color: "var(--ink-4)" }}>{d.location}</div>
                      </div>
                      <PlatformBadge platform={d.platform} />
                      <DurationCell mins={d.duration_minutes} />
                      <div>
                        {d.came_online === null
                          ? <span className="text-[11px] font-semibold" style={{ color: "#dc2626" }}>Offline</span>
                          : <span className="text-[11px]" style={{ color: "#16a34a" }}>Resolved</span>}
                      </div>
                    </div>
                  );
                })}
            </div>
          )
        )}
      </main>
    </div>
  );
}

// ── Small shared sub-components ───────────────────────────────────────────────

function PlatformBadge({ platform }: { platform: string }) {
  const color = platform === "swiggy" ? C.swiggy : C.zomato;
  return (
    <span className="text-[11px] font-bold px-2 py-0.5 rounded"
      style={{ background: `${color}18`, color }}>
      {platform.charAt(0).toUpperCase() + platform.slice(1)}
    </span>
  );
}

function DurationCell({ mins, dimmed }: { mins: number | null; dimmed?: boolean }) {
  const text = fmtDuration(mins);
  const loud = mins !== null && mins > 60;
  return (
    <div className="text-sm tabular-nums"
      style={{ color: dimmed ? "var(--ink-3)" : loud ? "#dc2626" : "var(--ink-2)" }}>
      {text}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-2" style={{ color: "var(--ink-4)" }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.3}>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
      <p className="text-sm">No incidents during operational hours</p>
      <p className="text-[11px] opacity-60">All stores were online (or outside store hours)</p>
    </div>
  );
}
