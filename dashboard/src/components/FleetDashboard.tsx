"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import type { RestaurantStatus, Snapshot } from "@/lib/fleet";

export type LocationData = {
  city: string;
  citySlug: string;
  location: string;
  locationSlug: string;
  brands: RestaurantStatus[];
  swiggyOfflineCount: number;
  zomatoOfflineCount: number;
  hasMismatch: boolean;
};

type Props = {
  locations: LocationData[];
  cities: string[];
  totalOnline: number;
  totalOffline: number;
  totalStale: number;
};

const C = {
  swiggy: "#FC8019",
  zomato: "#E23744",
  online: "#16a34a",
  offline: "#dc2626",
  amber: "#D97706",
};

function StatusChip({ open, active }: { open: boolean | null; active: boolean }) {
  if (!active) return <span className="text-xs" style={{ color: "var(--ink-4)" }}>—</span>;
  const bg = open === null ? "var(--surface-2)" : open ? "#F0FDF4" : "#FEF2F2";
  const color = open === null ? "var(--ink-4)" : open ? C.online : C.offline;
  const dot = open === null ? "var(--border-2)" : open ? C.online : C.offline;
  const label = open === null ? "No data" : open ? "Online" : "Offline";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
      style={{ background: bg, color, border: `1px solid ${open === null ? "var(--border)" : open ? "#BBF7D0" : "#FECACA"}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
      <span className="text-[11px] font-semibold">{label}</span>
    </span>
  );
}

function PlatformBadge({ color, label, offline, total }: { color: string; label: string; offline: number; total: number }) {
  const ok = offline === 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold tracking-wide" style={{ color }}>{label}</span>
      {ok ? (
        <span className="text-[10px] font-medium" style={{ color: C.online }}>✓ {total}/{total}</span>
      ) : (
        <span className="text-[10px] font-semibold" style={{ color: C.offline }}>{offline} offline</span>
      )}
    </div>
  );
}

function BrandRow({ s, locationHref }: { s: RestaurantStatus; locationHref: string }) {
  const { restaurant: r, swiggy, zomato } = s;
  const swiggyOpen = swiggy?.is_open ?? null;
  const zomatoOpen = zomato?.is_open ?? null;
  const swiggyIssue = r.should_be_live_swiggy && swiggyOpen === false;
  const zomatoIssue = r.should_be_live_zomato && zomatoOpen === false;
  const hasIssue = swiggyIssue || zomatoIssue;

  function platformCell(platform: "swiggy" | "zomato") {
    const snapData = platform === "swiggy" ? swiggy : zomato;
    const open = platform === "swiggy" ? swiggyOpen : zomatoOpen;
    const active = platform === "swiggy" ? r.should_be_live_swiggy : r.should_be_live_zomato;
    const age = snapData?.fetched_at
      ? formatDistanceToNow(new Date(snapData.fetched_at), { addSuffix: true })
      : null;
    return (
      <div>
        <StatusChip open={open} active={active} />
        {active && age && (
          <div className="text-[10px] mt-0.5" style={{ color: "var(--ink-4)" }}>{age}</div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={locationHref}
      className="flex items-center gap-4 pl-10 pr-5 py-2.5 border-t transition-colors group"
      style={{
        borderColor: "var(--border)",
        background: hasIssue ? "#FFFBF0" : "var(--surface)",
      }}
    >
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium" style={{ color: "var(--ink-2)" }}>{r.brand}</span>
      </div>
      <div className="w-36">{platformCell("swiggy")}</div>
      <div className="w-36">{platformCell("zomato")}</div>
      <div className="w-24 text-[11px]">
        {hasIssue && (
          <span className="font-semibold" style={{ color: C.amber }}>⚠ Issue</span>
        )}
      </div>
    </Link>
  );
}

function LocationCard({ loc }: { loc: LocationData }) {
  const hasIssues = loc.swiggyOfflineCount > 0 || loc.zomatoOfflineCount > 0;
  const [expanded, setExpanded] = useState(hasIssues);
  const href = `/l/${loc.citySlug}/${loc.locationSlug}`;
  const swiggyTotal = loc.brands.filter(b => b.restaurant.should_be_live_swiggy).length;
  const zomatoTotal = loc.brands.filter(b => b.restaurant.should_be_live_zomato).length;

  return (
    <div
      className="rounded-xl overflow-hidden transition-shadow hover:shadow-sm"
      style={{
        background: "var(--surface)",
        border: hasIssues ? "1px solid #FECACA" : "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(28,25,23,0.04)",
      }}
    >
      <button
        className="w-full flex items-center gap-4 px-5 py-3.5 text-left"
        style={{ background: hasIssues ? "#FFF8F8" : "var(--surface)" }}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Chevron */}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.5"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>

        {/* Location name */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{loc.location}</span>
          <span className="text-xs" style={{ color: "var(--ink-4)" }}>{loc.city}</span>
          <span className="text-[11px]" style={{ color: "var(--border-2)" }}>· {loc.brands.length} brands</span>
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-4">
          <PlatformBadge color={C.swiggy} label="Swiggy" offline={loc.swiggyOfflineCount} total={swiggyTotal} />
          <PlatformBadge color={C.zomato} label="Zomato" offline={loc.zomatoOfflineCount} total={zomatoTotal} />
        </div>

        {/* View link */}
        <Link
          href={href}
          onClick={e => e.stopPropagation()}
          className="text-[11px] font-semibold ml-2 whitespace-nowrap transition-colors"
          style={{ color: "var(--brand)" }}
        >
          View →
        </Link>
      </button>

      {expanded && (
        <div>
          <div
            className="flex items-center gap-4 pl-10 pr-5 py-2 border-t"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
          >
            <div className="flex-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--ink-4)" }}>Brand</div>
            <div className="w-36 text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.swiggy }}>Swiggy</div>
            <div className="w-36 text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.zomato }}>Zomato</div>
            <div className="w-24 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--ink-4)" }}>Flag</div>
          </div>
          {loc.brands.map(s => <BrandRow key={s.restaurant.id} s={s} locationHref={href} />)}
        </div>
      )}
    </div>
  );
}

export default function FleetDashboard({ locations, cities, totalOnline, totalOffline, totalStale }: Props) {
  const router = useRouter();
  const [selectedCity, setSelectedCity] = useState("All");

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [router]);

  const filtered = useMemo(
    () => selectedCity === "All" ? locations : locations.filter(l => l.city === selectedCity),
    [locations, selectedCity]
  );

  const total = totalOnline + totalOffline + totalStale;
  const uptime = total > 0 ? Math.round((totalOnline / total) * 100) : 100;
  const locationsWithIssues = filtered.filter(l => l.swiggyOfflineCount > 0 || l.zomatoOfflineCount > 0).length;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--canvas)" }}>
      {/* Page header */}
      <div
        className="px-8 py-5"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold" style={{ color: "var(--ink)" }}>Store Live</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-4)" }}>Real-time listing status across all platforms</p>
          </div>
          <div className="text-xs" style={{ color: "var(--ink-4)" }}>Scraper runs every 30 min</div>
        </div>

        {/* KPI strip */}
        <div className="flex items-center gap-3 mt-4">
          <div
            className="flex items-center gap-2.5 rounded-lg px-4 py-2.5"
            style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: C.online }} />
            <div>
              <div className="text-xl font-bold leading-none" style={{ color: C.online, fontVariantNumeric: "tabular-nums" }}>{totalOnline}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "#16a34a99" }}>Online</div>
            </div>
          </div>

          <div
            className="flex items-center gap-2.5 rounded-lg px-4 py-2.5"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: C.offline }} />
            <div>
              <div className="text-xl font-bold leading-none" style={{ color: C.offline, fontVariantNumeric: "tabular-nums" }}>{totalOffline}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "#dc262699" }}>Offline</div>
            </div>
          </div>

          {totalStale > 0 && (
            <div
              className="flex items-center gap-2.5 rounded-lg px-4 py-2.5"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--border-2)" }} />
              <div>
                <div className="text-xl font-bold leading-none" style={{ color: "var(--ink-4)", fontVariantNumeric: "tabular-nums" }}>{totalStale}</div>
                <div className="text-[10px] mt-0.5" style={{ color: "var(--ink-4)" }}>No data</div>
              </div>
            </div>
          )}

          <div
            className="flex items-center gap-2.5 rounded-lg px-4 py-2.5"
            style={{ background: "var(--brand-bg)", border: "1px solid #FED7AA" }}
          >
            <div>
              <div className="text-xl font-bold leading-none" style={{ color: "var(--brand)", fontVariantNumeric: "tabular-nums" }}>{uptime}%</div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--brand)" }}>Avg uptime</div>
            </div>
          </div>

          {locationsWithIssues > 0 && (
            <div
              className="flex items-center gap-2.5 rounded-lg px-4 py-2.5"
              style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
            >
              <div>
                <div className="text-xl font-bold leading-none" style={{ color: C.amber, fontVariantNumeric: "tabular-nums" }}>{locationsWithIssues}</div>
                <div className="text-[10px] mt-0.5" style={{ color: C.amber }}>Locations with issues</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* City filter tabs */}
      <div
        className="px-8"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex overflow-x-auto gap-1">
          {["All", ...cities].map(city => (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className="px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
              style={{
                borderColor: selectedCity === city ? "var(--brand)" : "transparent",
                color: selectedCity === city ? "var(--brand)" : "var(--ink-3)",
              }}
            >
              {city}
            </button>
          ))}
        </div>
      </div>

      {/* Locations list */}
      <main className="flex-1 px-8 py-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64" style={{ color: "var(--ink-4)" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-30">
              <path d="M17.94 11A8 8 0 1 0 11 17.94" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <p className="text-sm">No active restaurants found</p>
            <p className="text-xs mt-1 opacity-60">Add entries to the Google Sheet and run a sync</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered
              .sort((a, b) => {
                const aIssue = (a.swiggyOfflineCount > 0 || a.zomatoOfflineCount > 0) ? 0 : 1;
                const bIssue = (b.swiggyOfflineCount > 0 || b.zomatoOfflineCount > 0) ? 0 : 1;
                return aIssue - bIssue;
              })
              .map(loc => <LocationCard key={`${loc.citySlug}/${loc.locationSlug}`} loc={loc} />)}
          </div>
        )}
      </main>
    </div>
  );
}
