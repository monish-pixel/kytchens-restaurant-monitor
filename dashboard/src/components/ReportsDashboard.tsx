"use client";

import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import type { DowntimeRecord, UptimeSummary } from "@/app/reports/page";

const C = { swiggy: "#FC8019", zomato: "#E23744" };

function duration(mins: number | null) {
  if (mins === null) return <span className="text-gray-400 text-xs">Ongoing</span>;
  if (mins < 60) return <span className="font-semibold text-red-600">{mins}m</span>;
  const h = Math.floor(mins / 60), m = mins % 60;
  return <span className="font-semibold text-red-700">{h}h {m > 0 ? `${m}m` : ""}</span>;
}

type Props = {
  downtimes: DowntimeRecord[];
  summaries: UptimeSummary[];
};

export default function ReportsDashboard({ downtimes, summaries }: Props) {
  const [tab, setTab] = useState<"summary" | "log">("summary");
  const [platformFilter, setPlatformFilter] = useState<"all" | "swiggy" | "zomato">("all");

  const totalIncidents = summaries.reduce((s, x) => s + x.total_incidents, 0);
  const totalDowntimeMins = summaries.reduce((s, x) => s + x.total_downtime_minutes, 0);
  const worstBrand = summaries[0];

  const filteredDowntimes = downtimes.filter(d =>
    platformFilter === "all" || d.platform === platformFilter
  );
  const filteredSummaries = summaries.filter(s =>
    platformFilter === "all" || s.platform === platformFilter
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Reports</h1>
            <p className="text-xs text-gray-400 mt-0.5">Downtime history · Last 7 days</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="flex items-center gap-4 mt-4">
          <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
            <div className="text-xl font-bold text-red-700 leading-none">{totalIncidents}</div>
            <div className="text-[10px] text-red-600 mt-0.5">Downtime incidents (7d)</div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5">
            <div className="text-xl font-bold text-amber-700 leading-none">
              {totalDowntimeMins >= 60 ? `${Math.round(totalDowntimeMins / 60)}h` : `${totalDowntimeMins}m`}
            </div>
            <div className="text-[10px] text-amber-600 mt-0.5">Total downtime (7d)</div>
          </div>
          {worstBrand && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
              <div className="text-sm font-bold text-gray-700 leading-none">{worstBrand.brand}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                Most affected · {worstBrand.total_incidents} incidents
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border-b border-gray-200 px-8 py-3 flex items-center gap-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["summary", "log"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize"
              style={{
                background: tab === t ? "white" : "transparent",
                color: tab === t ? "#111827" : "#6b7280",
                boxShadow: tab === t ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
              }}>
              {t === "summary" ? "Brand Summary" : "Incident Log"}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["all", "swiggy", "zomato"] as const).map(p => (
            <button key={p} onClick={() => setPlatformFilter(p)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize"
              style={{
                background: platformFilter === p ? "white" : "transparent",
                color: platformFilter === p
                  ? p === "swiggy" ? C.swiggy : p === "zomato" ? C.zomato : "#111827"
                  : "#6b7280",
                boxShadow: platformFilter === p ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
              }}>
              {p === "all" ? "All platforms" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 px-8 py-6">
        {tab === "summary" ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-6 gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              <div className="col-span-2">Brand</div>
              <div>Platform</div>
              <div>Incidents</div>
              <div>Total Downtime</div>
              <div>Longest Incident</div>
            </div>
            {filteredSummaries.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">No downtime recorded in the last 7 days</div>
            ) : (
              filteredSummaries.map((s, i) => (
                <div key={i} className="grid grid-cols-6 gap-4 px-5 py-3 border-b border-gray-100 last:border-0 items-center">
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-gray-900">{s.brand}</div>
                    <div className="text-xs text-gray-400">{s.location} · {s.city}</div>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded"
                      style={{ background: `${s.platform === "swiggy" ? C.swiggy : C.zomato}15`, color: s.platform === "swiggy" ? C.swiggy : C.zomato }}>
                      {s.platform.charAt(0).toUpperCase() + s.platform.slice(1)}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-red-600">{s.total_incidents}</div>
                  <div>{duration(s.total_downtime_minutes)}</div>
                  <div>{duration(s.longest_downtime_minutes)}</div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-6 gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              <div className="col-span-2">Brand</div>
              <div>Platform</div>
              <div>Went Offline</div>
              <div>Came Online</div>
              <div>Duration</div>
            </div>
            {filteredDowntimes.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">No incidents recorded</div>
            ) : (
              filteredDowntimes.map((d, i) => (
                <div key={i} className="grid grid-cols-6 gap-4 px-5 py-3 border-b border-gray-100 last:border-0 items-center"
                  style={{ background: d.came_online === null ? "#fff8f0" : "white" }}>
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-gray-900">{d.brand}</div>
                    <div className="text-xs text-gray-400">{d.location} · {d.city}</div>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded"
                      style={{ background: `${d.platform === "swiggy" ? C.swiggy : C.zomato}15`, color: d.platform === "swiggy" ? C.swiggy : C.zomato }}>
                      {d.platform.charAt(0).toUpperCase() + d.platform.slice(1)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    <div>{format(new Date(d.went_offline), "dd MMM, HH:mm")}</div>
                    <div className="text-gray-400">{formatDistanceToNow(new Date(d.went_offline), { addSuffix: true })}</div>
                  </div>
                  <div className="text-xs text-gray-600">
                    {d.came_online ? (
                      <>
                        <div>{format(new Date(d.came_online), "dd MMM, HH:mm")}</div>
                        <div className="text-green-600 font-medium">Resolved</div>
                      </>
                    ) : (
                      <span className="text-amber-600 font-semibold">Still offline</span>
                    )}
                  </div>
                  <div>{duration(d.duration_minutes)}</div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
