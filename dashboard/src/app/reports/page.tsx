import { supabase } from "@/lib/supabase";
import ReportsDashboard from "@/components/ReportsDashboard";

export const revalidate = 300;

export type DowntimeRecord = {
  brand: string;
  location: string;
  location_slug: string;
  city: string;
  city_slug: string;
  platform: string;
  restaurant_id: string;
  went_offline: string;
  came_online: string | null;
  duration_minutes: number | null;
};

export type UptimeSummary = {
  brand: string;
  location: string;
  city: string;
  platform: string;
  total_incidents: number;
  total_downtime_minutes: number;
  longest_downtime_minutes: number;
};

export default async function ReportsPage() {
  // Get status changes from last 90 days — client filters by date range + store hours
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: changes } = await supabase
    .from("status_changes")
    .select("id,platform,restaurant_id,prev_open,curr_open,changed_at,brand,location_slug,city_slug")
    .gte("changed_at", cutoff)
    .eq("city_slug", "pune")
    .order("changed_at", { ascending: false });

  // Also fetch restaurants for brand/location/city names — Pune only
  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id,brand,location,city,swiggy_id,zomato_slug")
    .eq("active", true)
    .eq("city_slug", "pune");

  const restaurantMap = new Map<string, { brand: string; location: string; city: string }>();
  for (const r of restaurants ?? []) {
    if (r.swiggy_id) restaurantMap.set(`swiggy:${r.swiggy_id}`, { brand: r.brand, location: r.location, city: r.city });
    if (r.zomato_slug) restaurantMap.set(`zomato:${r.zomato_slug}`, { brand: r.brand, location: r.location, city: r.city });
  }

  // Build downtime periods: pair WENT OFFLINE → CAME ONLINE
  const changesByKey = new Map<string, typeof changes>();
  for (const c of (changes ?? [])) {
    const key = `${c.platform}:${c.restaurant_id}`;
    if (!changesByKey.has(key)) changesByKey.set(key, []);
    changesByKey.get(key)!.push(c);
  }

  const downtimes: DowntimeRecord[] = [];
  for (const [key, events] of changesByKey.entries()) {
    const info = restaurantMap.get(key);
    if (!info) continue;
    const [platform, ...rest] = key.split(":");
    const restaurantId = rest.join(":");

    // events are newest first; reverse to process chronologically
    const sorted = [...(events ?? [])].sort((a, b) => a.changed_at.localeCompare(b.changed_at));

    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      if (e.curr_open === false) {
        // went offline — find matching came-online
        const next = sorted.slice(i + 1).find(x => x.curr_open === true);
        const duration = next
          ? Math.round((new Date(next.changed_at).getTime() - new Date(e.changed_at).getTime()) / 60000)
          : null;
        downtimes.push({
          brand: info.brand,
          location: info.location,
          location_slug: e.location_slug ?? "",
          city: info.city,
          city_slug: e.city_slug ?? "",
          platform,
          restaurant_id: restaurantId,
          went_offline: e.changed_at,
          came_online: next?.changed_at ?? null,
          duration_minutes: duration,
        });
      }
    }
  }

  // Build uptime summary per brand+platform
  const summaryMap = new Map<string, UptimeSummary>();
  for (const d of downtimes) {
    const key = `${d.brand}:${d.platform}`;
    if (!summaryMap.has(key)) {
      summaryMap.set(key, {
        brand: d.brand,
        location: d.location,
        city: d.city,
        platform: d.platform,
        total_incidents: 0,
        total_downtime_minutes: 0,
        longest_downtime_minutes: 0,
      });
    }
    const s = summaryMap.get(key)!;
    s.total_incidents++;
    if (d.duration_minutes !== null) {
      s.total_downtime_minutes += d.duration_minutes;
      s.longest_downtime_minutes = Math.max(s.longest_downtime_minutes, d.duration_minutes);
    }
  }

  const summaries = [...summaryMap.values()].sort((a, b) =>
    b.total_downtime_minutes - a.total_downtime_minutes
  );

  return (
    <ReportsDashboard
      downtimes={downtimes}
      summaries={summaries}
    />
  );
}
