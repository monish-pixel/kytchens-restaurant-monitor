"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import type { Restaurant, Snapshot, StatusChange, Alert } from "@/lib/fleet";

type RestaurantStatus = {
  restaurant: Restaurant;
  swiggy: Snapshot | null;
  zomato: Snapshot | null;
};

type Props = {
  restaurants: RestaurantStatus[];
  statusChanges: StatusChange[];
  alerts: Alert[];
};

const C = {
  swiggy: "#FC8019",
  zomato: "#E23744",
  online: "#22C55E",
  offline: "#EF4444",
  amber: "#F59E0B",
};

function PlatformSummaryCard({
  platform,
  offlineCount,
  totalBrands,
}: {
  platform: "swiggy" | "zomato";
  offlineCount: number;
  totalBrands: number;
}) {
  const color = platform === "swiggy" ? C.swiggy : C.zomato;
  const label = platform === "swiggy" ? "SWIGGY" : "ZOMATO";
  const onlineBrands = totalBrands - offlineCount;
  const hasIssue = offlineCount > 0;

  return (
    <div
      className="rounded-xl border flex-1 p-4"
      style={{
        background: hasIssue ? "#130a0a" : "#0a1510",
        borderColor: hasIssue ? "#2e1414" : "#142010",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold tracking-wider" style={{ color }}>
          {label}
        </span>
        {hasIssue ? (
          <span className="text-xs font-bold" style={{ color: C.offline }}>
            ⚠ {offlineCount} offline
          </span>
        ) : (
          <span className="text-xs font-bold" style={{ color: C.online }}>
            ✓ All online
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-white">
        {onlineBrands}
        <span className="text-gray-600 text-sm font-normal"> / {totalBrands}</span>
      </div>
      <div className="text-xs text-gray-600 mt-0.5">brands online</div>
    </div>
  );
}

export default function LocationDashboard({
  restaurants,
  statusChanges,
  alerts,
}: Props) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [router]);

  const swiggyBrands = restaurants.filter((s) => s.restaurant.should_be_live_swiggy).length;
  const zomatoBrands = restaurants.filter((s) => s.restaurant.should_be_live_zomato).length;
  const swiggyOffline = restaurants.filter(
    (s) => s.restaurant.should_be_live_swiggy && s.swiggy && !s.swiggy.is_open
  ).length;
  const zomatoOffline = restaurants.filter(
    (s) => s.restaurant.should_be_live_zomato && s.zomato && !s.zomato.is_open
  ).length;

  const activeAlerts = alerts.filter((a) => !a.acknowledged_at);
  const firstR = restaurants[0]?.restaurant;

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0f1117", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Header */}
      <header
        className="border-b border-[#1a1e2e] px-6 py-4"
        style={{ background: "#080a10" }}
      >
        <div className="max-w-4xl mx-auto">
          <Link
            href="/"
            className="text-xs hover:opacity-80 mb-3 inline-block transition-opacity"
            style={{ color: "#3b82f6" }}
          >
            ← All locations
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">{firstR?.location}</h1>
              <p className="text-sm text-gray-500">{firstR?.city}</p>
            </div>
            <div className="text-xs text-gray-700">Auto-refreshes every 5 min</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* Active alarm banner */}
        {activeAlerts.length > 0 && (
          <div
            className="rounded-xl border p-4"
            style={{ background: "#150808", borderColor: "#3d1111" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold" style={{ color: C.offline }}>
                🔔 ALARM
              </span>
              <span className="text-sm text-gray-300">
                {activeAlerts.length} active alert
                {activeAlerts.length !== 1 ? "s" : ""}
              </span>
            </div>
            {activeAlerts.map((a) => (
              <div key={a.id} className="text-xs mt-1" style={{ color: "#fca5a5" }}>
                <span className="font-semibold capitalize">{a.platform}</span>
                {" · "}
                {a.alert_type.replace(/_/g, " ")}
                {a.details ? ` · ${a.details}` : ""}
              </div>
            ))}
          </div>
        )}

        {/* Platform summary cards */}
        <div className="flex gap-4">
          <PlatformSummaryCard
            platform="swiggy"
            offlineCount={swiggyOffline}
            totalBrands={swiggyBrands}
          />
          <PlatformSummaryCard
            platform="zomato"
            offlineCount={zomatoOffline}
            totalBrands={zomatoBrands}
          />
        </div>

        {/* Brand table */}
        <div className="rounded-xl border border-[#1a1e2e] overflow-hidden">
          {/* Table header */}
          <div
            className="flex items-center gap-4 px-4 py-2.5 border-b border-[#1a1e2e]"
            style={{ background: "#080a10" }}
          >
            <div className="flex-1 text-[10px] text-gray-600 uppercase tracking-widest">
              Brand
            </div>
            <div className="w-44 text-[10px] uppercase tracking-widest" style={{ color: C.swiggy }}>
              Swiggy
            </div>
            <div className="w-44 text-[10px] uppercase tracking-widest" style={{ color: C.zomato }}>
              Zomato
            </div>
            <div className="w-24 text-[10px] text-gray-600 uppercase tracking-widest">Flags</div>
          </div>

          {restaurants.map(({ restaurant: r, swiggy, zomato }) => {
            const swiggyOpen = swiggy?.is_open ?? null;
            const zomatoOpen = zomato?.is_open ?? null;
            const swiggyMismatch = r.should_be_live_swiggy && swiggyOpen === false;
            const zomatoMismatch = r.should_be_live_zomato && zomatoOpen === false;
            const hasMismatch = swiggyMismatch || zomatoMismatch;

            return (
              <div
                key={r.id}
                className="flex items-center gap-4 px-4 py-3 border-b border-[#1a1e2e] last:border-0"
                style={{ background: hasMismatch ? "#110a0a" : "#0f1117" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{r.brand}</div>
                  {(r.operational_hours_swiggy || r.operational_hours_zomato) && (
                    <div className="text-[10px] text-gray-700 mt-0.5">
                      {r.operational_hours_swiggy || r.operational_hours_zomato}
                    </div>
                  )}
                </div>

                {/* Swiggy */}
                <div className="w-44">
                  {r.should_be_live_swiggy ? (
                    <div>
                      <span
                        className="text-xs font-bold"
                        style={{
                          color:
                            swiggyOpen === null
                              ? "#4b5563"
                              : swiggyOpen
                              ? C.online
                              : C.offline,
                        }}
                      >
                        {swiggyOpen === null
                          ? "NO DATA"
                          : swiggyOpen
                          ? "ONLINE"
                          : "OFFLINE"}
                      </span>
                      {swiggy && (
                        <div className="text-[10px] text-gray-600 mt-0.5">
                          {formatDistanceToNow(new Date(swiggy.fetched_at), {
                            addSuffix: true,
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-700">Not active</span>
                  )}
                </div>

                {/* Zomato */}
                <div className="w-44">
                  {r.should_be_live_zomato ? (
                    <div>
                      <span
                        className="text-xs font-bold"
                        style={{
                          color:
                            zomatoOpen === null
                              ? "#4b5563"
                              : zomatoOpen
                              ? C.online
                              : C.offline,
                        }}
                      >
                        {zomatoOpen === null
                          ? "NO DATA"
                          : zomatoOpen
                          ? "ONLINE"
                          : "OFFLINE"}
                      </span>
                      {zomato && (
                        <div className="text-[10px] text-gray-600 mt-0.5">
                          {formatDistanceToNow(new Date(zomato.fetched_at), {
                            addSuffix: true,
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-700">Not active</span>
                  )}
                </div>

                {/* Flag */}
                <div className="w-24 text-xs">
                  {hasMismatch && (
                    <span style={{ color: C.amber }} className="font-medium">
                      ⚠ MISMATCH
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Status history */}
        {statusChanges.length > 0 && (
          <div className="rounded-xl border border-[#1a1e2e] overflow-hidden">
            <div
              className="px-4 py-2.5 border-b border-[#1a1e2e]"
              style={{ background: "#080a10" }}
            >
              <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
                Recent Status Changes
              </span>
            </div>
            {statusChanges.map((sc) => (
              <div
                key={sc.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1a1e2e] last:border-0"
                style={{ background: "#0f1117" }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: sc.curr_open ? C.online : C.offline }}
                />
                <span className="text-xs text-gray-500 capitalize">{sc.platform}</span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: sc.curr_open ? C.online : C.offline }}
                >
                  {sc.curr_open ? "came online" : "went offline"}
                </span>
                <span className="ml-auto text-xs text-gray-700">
                  {formatDistanceToNow(new Date(sc.changed_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Menu items */}
        <div className="rounded-xl border border-[#1a1e2e] p-4" style={{ background: "#0b0d14" }}>
          <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-3">
            Menu Items
          </div>
          <div className="text-xs text-gray-700">
            Menu item monitoring not yet configured.{" "}
            <span className="text-gray-600">
              Add items to the &ldquo;Items Master&rdquo; tab in Google Sheets to enable this
              section.
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
