"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
  online: "#22C55E",
  offline: "#EF4444",
  amber: "#F59E0B",
};

function latestAgo(snap: Snapshot | null) {
  if (!snap) return null;
  return formatDistanceToNow(new Date(snap.fetched_at), { addSuffix: true });
}

function BrandRow({ s, locationHref }: { s: RestaurantStatus; locationHref: string }) {
  const { restaurant: r, swiggy, zomato } = s;
  const swiggyOpen = swiggy?.is_open ?? null;
  const zomatoOpen = zomato?.is_open ?? null;
  const swiggyMismatch = r.should_be_live_swiggy && swiggyOpen === false;
  const zomatoMismatch = r.should_be_live_zomato && zomatoOpen === false;
  const unexpectedSwiggy = !r.should_be_live_swiggy && swiggyOpen === true;
  const unexpectedZomato = !r.should_be_live_zomato && zomatoOpen === true;
  const hasMismatch = swiggyMismatch || zomatoMismatch || unexpectedSwiggy || unexpectedZomato;

  return (
    <Link
      href={locationHref}
      className="flex items-center gap-4 pl-10 pr-4 py-2.5 border-t border-[#1a1e2e] hover:bg-[#141928] transition-colors"
      style={{ background: hasMismatch ? "#110a0a" : "#0b0d14" }}
    >
      <div className="flex-1 text-sm text-gray-300">{r.brand}</div>

      {/* Swiggy */}
      <div className="w-36">
        {r.should_be_live_swiggy ? (
          <div>
            <span
              className="text-xs font-bold"
              style={{
                color:
                  swiggyOpen === null ? "#4b5563" : swiggyOpen ? C.online : C.offline,
              }}
            >
              {swiggyOpen === null ? "NO DATA" : swiggyOpen ? "ONLINE" : "OFFLINE"}
            </span>
            {swiggy && (
              <div className="text-[10px] text-gray-600">{latestAgo(swiggy)}</div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-700">—</span>
        )}
      </div>

      {/* Zomato */}
      <div className="w-36">
        {r.should_be_live_zomato ? (
          <div>
            <span
              className="text-xs font-bold"
              style={{
                color:
                  zomatoOpen === null ? "#4b5563" : zomatoOpen ? C.online : C.offline,
              }}
            >
              {zomatoOpen === null ? "NO DATA" : zomatoOpen ? "ONLINE" : "OFFLINE"}
            </span>
            {zomato && (
              <div className="text-[10px] text-gray-600">{latestAgo(zomato)}</div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-700">—</span>
        )}
      </div>

      {/* Flag */}
      <div className="w-28 text-xs">
        {hasMismatch && (
          <span style={{ color: C.amber }} className="font-medium">
            ⚠ MISMATCH
          </span>
        )}
      </div>
    </Link>
  );
}

function LocationRow({ loc }: { loc: LocationData }) {
  const hasIssues = loc.swiggyOfflineCount > 0 || loc.zomatoOfflineCount > 0;
  const [expanded, setExpanded] = useState(hasIssues);
  const href = `/l/${loc.citySlug}/${loc.locationSlug}`;

  return (
    <div
      className="rounded-lg overflow-hidden border"
      style={{
        borderColor: hasIssues ? "#2e1515" : "#1a1e2e",
      }}
    >
      <button
        className="w-full flex items-center gap-4 px-4 py-3 text-left transition-colors"
        style={{
          background: hasIssues ? "#150e0e" : "#0d0f18",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-gray-600 text-[10px] w-3 flex-shrink-0">
          {expanded ? "▼" : "▶"}
        </span>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-white truncate">{loc.location}</span>
          <span className="text-xs text-gray-600 flex-shrink-0">{loc.city}</span>
          <span className="text-[11px] text-gray-700 flex-shrink-0">
            · {loc.brands.length} brand{loc.brands.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Swiggy count */}
        <div className="w-36 text-xs flex-shrink-0">
          {loc.swiggyOfflineCount > 0 ? (
            <span className="font-semibold" style={{ color: C.swiggy }}>
              ⚠ {loc.swiggyOfflineCount} offline
            </span>
          ) : (
            <span style={{ color: C.online }} className="font-medium">
              ✓ Swiggy ok
            </span>
          )}
        </div>

        {/* Zomato count */}
        <div className="w-36 text-xs flex-shrink-0">
          {loc.zomatoOfflineCount > 0 ? (
            <span className="font-semibold" style={{ color: C.zomato }}>
              ⚠ {loc.zomatoOfflineCount} offline
            </span>
          ) : (
            <span style={{ color: C.online }} className="font-medium">
              ✓ Zomato ok
            </span>
          )}
        </div>

        {/* Flags */}
        <div className="w-28 text-xs flex-shrink-0">
          {loc.hasMismatch && (
            <span style={{ color: C.amber }} className="font-medium">
              ⚠ MISMATCH
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div>
          {/* Sub-header */}
          <div
            className="flex items-center gap-4 pl-10 pr-4 py-2 border-t border-[#1a1e2e]"
            style={{ background: "#08090f" }}
          >
            <div className="flex-1 text-[10px] text-gray-600 uppercase tracking-widest">Brand</div>
            <div className="w-36 text-[10px] text-gray-600 uppercase tracking-widest">
              <span style={{ color: C.swiggy }}>Swiggy</span>
            </div>
            <div className="w-36 text-[10px] text-gray-600 uppercase tracking-widest">
              <span style={{ color: C.zomato }}>Zomato</span>
            </div>
            <div className="w-28 text-[10px] text-gray-600 uppercase tracking-widest">Flags</div>
          </div>
          {loc.brands.map((s) => (
            <BrandRow key={s.restaurant.id} s={s} locationHref={href} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FleetDashboard({
  locations,
  cities,
  totalOnline,
  totalOffline,
  totalStale,
}: Props) {
  const [selectedCity, setSelectedCity] = useState("All");

  const filtered = useMemo(
    () =>
      selectedCity === "All"
        ? locations
        : locations.filter((l) => l.city === selectedCity),
    [locations, selectedCity]
  );

  const total = totalOnline + totalOffline + totalStale;

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0f1117", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Top header */}
      <header
        className="border-b border-[#1a1e2e] px-6 py-4"
        style={{ background: "#080a10" }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              Kytchens Fleet Monitor
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "#4b5563" }}>
              {total} listing{total !== 1 ? "s" : ""} · refreshes every 60s
            </p>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <span className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ background: C.online }}
              />
              <span className="font-semibold text-xs" style={{ color: C.online }}>
                {totalOnline} online
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ background: C.offline }}
              />
              <span className="font-semibold text-xs" style={{ color: C.offline }}>
                {totalOffline} offline
              </span>
            </span>
            {totalStale > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-700 inline-block" />
                <span className="text-xs text-gray-600">{totalStale} stale</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* City tabs */}
      <div
        className="border-b border-[#1a1e2e] px-6"
        style={{ background: "#080a10" }}
      >
        <div className="max-w-7xl mx-auto flex overflow-x-auto">
          {["All", ...cities].map((city) => (
            <button
              key={city}
              className="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
              style={{
                borderColor: selectedCity === city ? "#3b82f6" : "transparent",
                color: selectedCity === city ? "#fff" : "#6b7280",
              }}
              onClick={() => setSelectedCity(city)}
            >
              {city}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-5">
        {filtered.length > 0 && (
          <div className="flex items-center gap-4 px-4 pb-2 mb-1">
            <div className="flex-1 text-[10px] text-gray-700 uppercase tracking-widest pl-7">
              Location
            </div>
            <div className="w-36 text-[10px] text-gray-700 uppercase tracking-widest">
              <span style={{ color: C.swiggy }}>Swiggy</span>
            </div>
            <div className="w-36 text-[10px] text-gray-700 uppercase tracking-widest">
              <span style={{ color: C.zomato }}>Zomato</span>
            </div>
            <div className="w-28 text-[10px] text-gray-700 uppercase tracking-widest">Flags</div>
          </div>
        )}

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-24 text-gray-600 text-sm">
              No active restaurants found.
              <br />
              <span className="text-gray-700 text-xs mt-1 block">
                Add entries to the Google Sheet and run a sync.
              </span>
            </div>
          ) : (
            filtered
              .sort((a, b) => {
                const aHasIssues =
                  a.swiggyOfflineCount > 0 || a.zomatoOfflineCount > 0 ? 0 : 1;
                const bHasIssues =
                  b.swiggyOfflineCount > 0 || b.zomatoOfflineCount > 0 ? 0 : 1;
                return aHasIssues - bHasIssues;
              })
              .map((loc) => (
                <LocationRow key={`${loc.citySlug}/${loc.locationSlug}`} loc={loc} />
              ))
          )}
        </div>
      </main>
    </div>
  );
}
