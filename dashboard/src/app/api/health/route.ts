import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const STALE_THRESHOLD_MINUTES = 90;

export const revalidate = 0;

export async function GET() {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("snapshots")
    .select("platform, restaurant_id, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 503 }
    );
  }

  const latest = data?.[0];
  if (!latest) {
    return NextResponse.json(
      { status: "stale", message: "No snapshots found", stale_minutes: null },
      { status: 503 }
    );
  }

  const fetchedAt = new Date(latest.fetched_at);
  const staleMinutes = Math.floor((Date.now() - fetchedAt.getTime()) / 60000);
  const isStale = latest.fetched_at < cutoff;

  if (isStale) {
    return NextResponse.json(
      {
        status: "stale",
        message: `Last scrape was ${staleMinutes} minutes ago — scraper may be down`,
        last_scrape: latest.fetched_at,
        stale_minutes: staleMinutes,
        threshold_minutes: STALE_THRESHOLD_MINUTES,
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    status: "ok",
    last_scrape: latest.fetched_at,
    stale_minutes: staleMinutes,
    threshold_minutes: STALE_THRESHOLD_MINUTES,
  });
}
