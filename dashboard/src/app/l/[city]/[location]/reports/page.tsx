import { supabase } from "@/lib/supabase";
import ReportsDashboard from "@/components/ReportsDashboard";
import type { DowntimeRecord, UptimeSummary } from "@/app/reports/page";

export const revalidate = 60;

type Props = { params: Promise<{ city: string; location: string }> };

export default async function KitchenReportsPage({ params }: Props) {
  const { city, location } = await params;
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: changes }, { data: restaurants }] = await Promise.all([
    supabase
      .from("status_changes")
      .select("id,platform,restaurant_id,prev_open,curr_open,changed_at,brand,location_slug,city_slug")
      .gte("changed_at", cutoff)
      .eq("location_slug", location)
      .eq("city_slug", city)
      .order("changed_at", { ascending: false }),
    supabase
      .from("restaurants")
      .select("id,brand,location,city,swiggy_id,zomato_slug")
      .eq("active", true)
      .eq("city_slug", city)
      .eq("location_slug", location),
  ]);

  const restaurantMap = new Map<string, { brand: string; location: string; city: string }>();
  for (const r of restaurants ?? []) {
    if (r.swiggy_id) restaurantMap.set(`swiggy:${r.swiggy_id}`, { brand: r.brand, location: r.location, city: r.city });
    if (r.zomato_slug) restaurantMap.set(`zomato:${r.zomato_slug}`, { brand: r.brand, location: r.location, city: r.city });
  }

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
    const sorted = [...(events ?? [])].sort((a, b) => a.changed_at.localeCompare(b.changed_at));
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      if (e.curr_open === false) {
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
