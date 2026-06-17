"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { Restaurant, Snapshot, MenuItem, StatusChange, Alert, UptimeSlot, UptimeHistory } from "@/lib/fleet";
import { supabase } from "@/lib/supabase";

type RestaurantStatus = {
  restaurant: Restaurant;
  swiggy: Snapshot | null;
  zomato: Snapshot | null;
};

type Props = {
  restaurants: RestaurantStatus[];
  statusChanges: StatusChange[];
  alerts: Alert[];
  uptimeHistory: UptimeHistory;
};

function UptimeSparkline({ slots }: { slots: UptimeSlot[] }) {
  const W = 4, H = 16, GAP = 1;
  const totalW = slots.length * (W + GAP) - GAP;
  return (
    <svg width={totalW} height={H} style={{ display: "block" }}>
      {slots.map((slot, i) => (
        <rect
          key={i}
          x={i * (W + GAP)}
          y={0}
          width={W}
          height={H}
          fill={slot === "online" ? "#16a34a" : slot === "offline" ? "#dc2626" : "#d1d5db"}
          rx={1}
        />
      ))}
    </svg>
  );
}

function LiveItemsList({ snap }: { snap: Snapshot | null }) {
  if (!snap || snap.items.length === 0) return null;

  const byCategory = snap.items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category ?? "Other";
    (acc[cat] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="mt-2 space-y-2">
      {Object.entries(byCategory).map(([cat, items]) => (
        <div key={cat}>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{cat}</div>
          <div className="flex flex-wrap gap-1">
            {items.map((item, i) => (
              <span
                key={i}
                className={`text-[11px] rounded px-1.5 py-0.5 border ${
                  item.in_stock
                    ? "bg-green-50 text-green-800 border-green-200"
                    : "bg-gray-50 text-gray-400 border-gray-200 line-through"
                }`}
              >
                {item.name}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const C = {
  swiggy: "#FC8019",
  zomato: "#E23744",
  online: "#16a34a",
  offline: "#dc2626",
  amber: "#d97706",
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
        background: hasIssue ? "#fff5f5" : "#f0fdf4",
        borderColor: hasIssue ? "#fca5a5" : "#bbf7d0",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold tracking-wider" style={{ color }}>
          {label}
        </span>
        {hasIssue ? (
          <span className="text-xs font-bold text-red-600">⚠ {offlineCount} offline</span>
        ) : (
          <span className="text-xs font-bold text-green-700">✓ All online</span>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {onlineBrands}
        <span className="text-gray-400 text-sm font-normal"> / {totalBrands}</span>
      </div>
      <div className="text-xs text-gray-400 mt-0.5">brands online</div>
    </div>
  );
}

export default function LocationDashboard({
  restaurants,
  statusChanges,
  alerts,
  uptimeHistory,
}: Props) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60 * 1000);
    return () => clearInterval(id);
  }, [router]);

  async function dismissAllAlerts() {
    setDismissing(true);
    const ids = activeAlerts.map((a) => a.id);
    if (ids.length > 0) {
      await supabase
        .from("alerts")
        .update({ acknowledged_at: new Date().toISOString() })
        .in("id", ids);
    }
    setDismissing(false);
    router.refresh();
  }

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

  // Most recent snapshot across all brands/platforms
  const allSnaps = restaurants.flatMap(({ swiggy, zomato }) => [swiggy, zomato]).filter(Boolean) as Snapshot[];
  const latestFetchedAt = allSnaps.length > 0
    ? allSnaps.reduce((a, b) => (a.fetched_at > b.fetched_at ? a : b)).fetched_at
    : null;

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/"
            className="text-xs text-blue-600 hover:text-blue-800 mb-3 inline-block transition-colors"
          >
            ← All locations
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{firstR?.location}</h1>
              <p className="text-sm text-gray-500">{firstR?.city}</p>
            </div>
            <div className="text-right">
              {latestFetchedAt ? (
                <div className="text-xs font-medium text-gray-600">
                  Data from {formatDistanceToNow(new Date(latestFetchedAt), { addSuffix: true })}
                </div>
              ) : (
                <div className="text-xs text-gray-400">No recent data</div>
              )}
              <div className="text-[10px] text-gray-400 mt-0.5">Auto-refreshes every 60s</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* Active alarm banner */}
        {activeAlerts.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-red-700">🔔 ALARM</span>
                <span className="text-sm text-red-600">
                  {activeAlerts.length} active alert{activeAlerts.length !== 1 ? "s" : ""}
                </span>
              </div>
              <button
                onClick={dismissAllAlerts}
                disabled={dismissing}
                className="text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-0.5 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {dismissing ? "Dismissing…" : "Dismiss all"}
              </button>
            </div>
            {activeAlerts.map((a) => (
              <div key={a.id} className="text-xs text-red-700 mt-1">
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
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          {/* Table header */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            <div className="flex-1 text-[10px] text-gray-400 uppercase tracking-widest">Brand</div>
            <div className="w-44 text-[10px] uppercase tracking-widest" style={{ color: C.swiggy }}>
              Swiggy
            </div>
            <div className="w-44 text-[10px] uppercase tracking-widest" style={{ color: C.zomato }}>
              Zomato
            </div>
            <div className="w-24 text-[10px] text-gray-400 uppercase tracking-widest">Flags</div>
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
                className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0"
                style={{ background: hasMismatch ? "#fff9f0" : "white" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{r.brand}</div>
                  {(r.operational_hours_swiggy || r.operational_hours_zomato) && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
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
                            swiggyOpen === null ? "#9ca3af" : swiggyOpen ? C.online : C.offline,
                        }}
                      >
                        {swiggyOpen === null ? "NO DATA" : swiggyOpen ? "ONLINE" : "OFFLINE"}
                      </span>
                      {swiggy && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {formatDistanceToNow(new Date(swiggy.fetched_at), { addSuffix: true })}
                        </div>
                      )}
                      {swiggy && swiggy.item_count > 0 && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {swiggy.item_count} items
                          {swiggy.items_out_of_stock > 0 && (
                            <span className="text-amber-600 font-medium"> · {swiggy.items_out_of_stock} OOS</span>
                          )}
                        </div>
                      )}
                      {r.swiggy_id && uptimeHistory[`swiggy:${r.swiggy_id}`] && (
                        <div className="mt-1.5">
                          <UptimeSparkline slots={uptimeHistory[`swiggy:${r.swiggy_id}`]} />
                          <div className="text-[9px] text-gray-300 mt-0.5">7d</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">Not active</span>
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
                            zomatoOpen === null ? "#9ca3af" : zomatoOpen ? C.online : C.offline,
                        }}
                      >
                        {zomatoOpen === null ? "NO DATA" : zomatoOpen ? "ONLINE" : "OFFLINE"}
                      </span>
                      {zomato && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {formatDistanceToNow(new Date(zomato.fetched_at), { addSuffix: true })}
                        </div>
                      )}
                      {zomato && zomato.item_count > 0 && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {zomato.item_count} items
                          {zomato.items_out_of_stock > 0 && (
                            <span className="text-amber-600 font-medium"> · {zomato.items_out_of_stock} OOS</span>
                          )}
                        </div>
                      )}
                      {r.zomato_slug && uptimeHistory[`zomato:${r.zomato_slug}`] && (
                        <div className="mt-1.5">
                          <UptimeSparkline slots={uptimeHistory[`zomato:${r.zomato_slug}`]} />
                          <div className="text-[9px] text-gray-300 mt-0.5">7d</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">Not active</span>
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
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Recent Status Changes
              </span>
            </div>
            {statusChanges.map((sc) => (
              <div
                key={sc.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0"
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
                <span className="ml-auto text-xs text-gray-400">
                  {formatDistanceToNow(new Date(sc.changed_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Live menu items per brand */}
        {restaurants.some(({ swiggy, zomato }) => (swiggy?.items?.length ?? 0) > 0 || (zomato?.items?.length ?? 0) > 0) && (
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Live Menu Items
              </span>
            </div>
            {restaurants.map(({ restaurant: r, swiggy, zomato }) => {
              const hasSwiggyItems = (swiggy?.items?.length ?? 0) > 0;
              const hasZomatoItems = (zomato?.items?.length ?? 0) > 0;
              if (!hasSwiggyItems && !hasZomatoItems) return null;
              return (
                <div key={r.id} className="px-4 py-3 border-b border-gray-100 last:border-0">
                  <div className="text-sm font-semibold text-gray-800 mb-2">{r.brand}</div>
                  <div className="grid grid-cols-2 gap-4">
                    {r.should_be_live_swiggy && hasSwiggyItems && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: C.swiggy }}>Swiggy</div>
                        <LiveItemsList snap={swiggy} />
                      </div>
                    )}
                    {r.should_be_live_zomato && hasZomatoItems && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: C.zomato }}>Zomato</div>
                        <LiveItemsList snap={zomato} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
