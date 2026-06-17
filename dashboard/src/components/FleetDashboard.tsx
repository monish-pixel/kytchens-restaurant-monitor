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
  amber: "#d97706",
};

function StatusDot({ open }: { open: boolean | null }) {
  const color = open === null ? "#d1d5db" : open ? C.online : C.offline;
  return <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: color }} />;
}

function PlatformBadge({ color, label, offline, total }: { color: string; label: string; offline: number; total: number }) {
  const ok = offline === 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
      {ok ? (
        <span className="text-[10px] font-medium text-green-600">✓ {total}/{total}</span>
      ) : (
        <span className="text-[10px] font-semibold text-red-600">{offline} offline</span>
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

  function snap(platform: "swiggy" | "zomato") {
    const snap = platform === "swiggy" ? swiggy : zomato;
    const open = platform === "swiggy" ? swiggyOpen : zomatoOpen;
    const active = platform === "swiggy" ? r.should_be_live_swiggy : r.should_be_live_zomato;
    if (!active) return <span className="text-[11px] text-gray-300">—</span>;
    return (
      <div className="flex items-center gap-1.5">
        <StatusDot open={open} />
        <div>
          <div className="text-[11px] font-semibold leading-none" style={{ color: open === null ? "#9ca3af" : open ? C.online : C.offline }}>
            {open === null ? "No data" : open ? "Online" : "Offline"}
          </div>
          {snap && (
            <div className="text-[10px] text-gray-400 mt-0.5">
              {snap.item_count > 0 && `${snap.item_count} items`}
              {snap.items_out_of_stock > 0 && <span className="text-amber-500"> · {snap.items_out_of_stock} OOS</span>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={locationHref}
      className="flex items-center gap-4 pl-10 pr-5 py-2.5 border-t border-gray-100 hover:bg-blue-50/30 transition-colors group"
      style={{ background: hasIssue ? "#fffbf0" : "white" }}
    >
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-700 group-hover:text-gray-900">{r.brand}</span>
      </div>
      <div className="w-32">{snap("swiggy")}</div>
      <div className="w-32">{snap("zomato")}</div>
      <div className="w-24 text-[11px]">
        {hasIssue && <span className="font-semibold text-amber-600">⚠ Mismatch</span>}
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
    <div className="bg-white rounded-xl border overflow-hidden transition-shadow hover:shadow-sm"
      style={{ borderColor: hasIssues ? "#fca5a5" : "#e5e7eb" }}>

      <button
        className="w-full flex items-center gap-4 px-5 py-3.5 text-left"
        style={{ background: hasIssues ? "#fff5f5" : "white" }}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Chevron */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>

        {/* Location name */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{loc.location}</span>
          <span className="text-xs text-gray-400">{loc.city}</span>
          <span className="text-[11px] text-gray-300">· {loc.brands.length} brands</span>
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
          className="text-[11px] text-blue-500 hover:text-blue-700 font-medium ml-2 whitespace-nowrap"
        >
          View →
        </Link>
      </button>

      {expanded && (
        <div>
          <div className="flex items-center gap-4 pl-10 pr-5 py-2 bg-gray-50 border-t border-gray-100">
            <div className="flex-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Brand</div>
            <div className="w-32 text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.swiggy }}>Swiggy</div>
            <div className="w-32 text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.zomato }}>Zomato</div>
            <div className="w-24 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Flag</div>
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
    const id = setInterval(() => router.refresh(), 60_000);
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
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Store Live</h1>
            <p className="text-xs text-gray-400 mt-0.5">Real-time listing status across all platforms</p>
          </div>
          <div className="text-xs text-gray-400">Auto-refreshes every 60s</div>
        </div>

        {/* Summary KPI strip */}
        <div className="flex items-center gap-6 mt-4">
          <div className="flex items-center gap-2.5 bg-green-50 border border-green-100 rounded-lg px-4 py-2.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <div>
              <div className="text-xl font-bold text-green-700 leading-none">{totalOnline}</div>
              <div className="text-[10px] text-green-600 mt-0.5">Online</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <div>
              <div className="text-xl font-bold text-red-700 leading-none">{totalOffline}</div>
              <div className="text-[10px] text-red-600 mt-0.5">Offline</div>
            </div>
          </div>
          {totalStale > 0 && (
            <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              <div>
                <div className="text-xl font-bold text-gray-500 leading-none">{totalStale}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">No data</div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
            <div>
              <div className="text-xl font-bold text-blue-700 leading-none">{uptime}%</div>
              <div className="text-[10px] text-blue-600 mt-0.5">Avg uptime</div>
            </div>
          </div>
          {locationsWithIssues > 0 && (
            <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5">
              <div>
                <div className="text-xl font-bold text-amber-700 leading-none">{locationsWithIssues}</div>
                <div className="text-[10px] text-amber-600 mt-0.5">Locations with issues</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* City filter tabs */}
      <div className="bg-white border-b border-gray-200 px-8">
        <div className="flex overflow-x-auto gap-1">
          {["All", ...cities].map(city => (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className="px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
              style={{
                borderColor: selectedCity === city ? "#2563eb" : "transparent",
                color: selectedCity === city ? "#1d4ed8" : "#6b7280",
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
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 text-gray-300">
              <path d="M17.94 11A8 8 0 1 0 11 17.94" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <p className="text-sm">No active restaurants found</p>
            <p className="text-xs mt-1 text-gray-300">Add entries to the Google Sheet and run a sync</p>
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
