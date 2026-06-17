import { supabase } from "./supabase";

export type Restaurant = {
  id: number;
  brand: string;
  location: string;
  location_slug: string;
  city: string;
  city_slug: string;
  swiggy_id: string | null;
  swiggy_slug: string | null;
  zomato_slug: string | null;
  operational_hours_swiggy: string | null;
  operational_hours_zomato: string | null;
  should_be_live_swiggy: boolean;
  should_be_live_zomato: boolean;
};

export type MenuItem = {
  name: string;
  category: string | null;
  in_stock: boolean;
};

export type Snapshot = {
  id: number;
  platform: string;
  restaurant_id: string;
  is_open: boolean;
  fetched_at: string;
  item_count: number;
  items_out_of_stock: number;
  items: MenuItem[];
};

export type StatusChange = {
  id: number;
  platform: string;
  prev_open: boolean;
  curr_open: boolean;
  changed_at: string;
  restaurant_id: string;
};

export type Alert = {
  id: number;
  platform: string;
  alert_type: string;
  details: string;
  created_at: string;
  acknowledged_at: string | null;
};

// slot = 0..167 (hour index over 7 days, 0 = oldest)
// "online" | "offline" | "unknown"
export type UptimeSlot = "online" | "offline" | "unknown";
export type UptimeHistory = Record<string, UptimeSlot[]>; // key = "platform:restaurant_id"

export type RestaurantStatus = {
  restaurant: Restaurant;
  swiggy: Snapshot | null;
  zomato: Snapshot | null;
};

// Returns latest snapshot per (platform, restaurant_id) from the last 6h.
// Supabase JS doesn't support DISTINCT ON, so we fetch recent rows and
// deduplicate in JS. At ≤450 restaurants × 2 platforms × 12 cycles = ~10,800
// rows max — well within a single round-trip.
async function getLatestSnapshots(): Promise<Map<string, Snapshot>> {
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("snapshots")
    .select("id, platform, restaurant_id, is_open, fetched_at")
    .gte("fetched_at", cutoff)
    .order("fetched_at", { ascending: false });

  if (error) throw new Error(`snapshots query failed: ${error.message}`);

  // Deduplicate: keep only the latest per (platform, restaurant_id)
  const map = new Map<string, Snapshot>();
  for (const row of data ?? []) {
    const key = `${row.platform}:${row.restaurant_id}`;
    if (!map.has(key)) map.set(key, { ...row, item_count: 0, items_out_of_stock: 0, items: [] } as Snapshot);
  }

  // Fetch item details for the deduped snapshot IDs only
  const snapIds = [...map.values()].map((s) => s.id);
  if (snapIds.length > 0) {
    const byId = new Map<number, Snapshot>();
    for (const s of map.values()) byId.set(s.id, s);

    const { data: items } = await supabase
      .from("menu_items")
      .select("snapshot_id, name, category, in_stock")
      .in("snapshot_id", snapIds);

    for (const item of items ?? []) {
      const snap = byId.get(item.snapshot_id);
      if (snap) {
        snap.item_count++;
        if (!item.in_stock) snap.items_out_of_stock++;
        snap.items.push({ name: item.name, category: item.category ?? null, in_stock: item.in_stock });
      }
    }
  }

  return map;
}

export async function getFleetStatus(): Promise<{
  byCity: Record<string, Record<string, RestaurantStatus[]>>;
  totalOnline: number;
  totalOffline: number;
  totalStale: number;
}> {
  const [{ data: restaurants, error }, snapMap] = await Promise.all([
    supabase
      .from("restaurants")
      .select(
        "id,brand,location,location_slug,city,city_slug,swiggy_id,swiggy_slug,zomato_slug,operational_hours_swiggy,operational_hours_zomato,should_be_live_swiggy,should_be_live_zomato"
      )
      .eq("active", true)
      .order("city")
      .order("location"),
    getLatestSnapshots(),
  ]);

  if (error) throw new Error(`restaurants query failed: ${error.message}`);

  let totalOnline = 0;
  let totalOffline = 0;
  let totalStale = 0;

  const byCity: Record<string, Record<string, RestaurantStatus[]>> = {};

  for (const r of restaurants ?? []) {
    const restaurant = r as Restaurant;
    const swiggy = restaurant.swiggy_id
      ? (snapMap.get(`swiggy:${restaurant.swiggy_id}`) ?? null)
      : null;
    const zomato = restaurant.zomato_slug
      ? (snapMap.get(`zomato:${restaurant.zomato_slug}`) ?? null)
      : null;

    // Count online/offline/stale per listing
    for (const [snap, shouldBeLive] of [
      [swiggy, restaurant.should_be_live_swiggy],
      [zomato, restaurant.should_be_live_zomato],
    ] as [Snapshot | null, boolean][]) {
      if (!shouldBeLive) continue;
      if (!snap) { totalStale++; continue; }
      snap.is_open ? totalOnline++ : totalOffline++;
    }

    const city = restaurant.city;
    const location = restaurant.location;
    byCity[city] ??= {};
    byCity[city][location] ??= [];
    byCity[city][location].push({ restaurant, swiggy, zomato });
  }

  return { byCity, totalOnline, totalOffline, totalStale };
}

export async function getUptimeHistory(restaurantIds: string[]): Promise<UptimeHistory> {
  if (!restaurantIds.length) return {};

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowMs = Date.now();
  const slots = 7 * 24; // 168 hourly slots

  const { data: changes } = await supabase
    .from("status_changes")
    .select("platform, restaurant_id, curr_open, changed_at")
    .in("restaurant_id", restaurantIds)
    .gte("changed_at", sevenDaysAgo)
    .order("changed_at", { ascending: true });

  // Also get current snapshot to know latest state
  const { data: latestSnaps } = await supabase
    .from("snapshots")
    .select("platform, restaurant_id, is_open, fetched_at")
    .in("restaurant_id", restaurantIds)
    .order("fetched_at", { ascending: false });

  // Build latest state per key
  const latestState = new Map<string, boolean>();
  for (const s of latestSnaps ?? []) {
    const k = `${s.platform}:${s.restaurant_id}`;
    if (!latestState.has(k)) latestState.set(k, s.is_open);
  }

  // Group changes by key
  const byKey = new Map<string, typeof changes>();
  for (const c of changes ?? []) {
    const k = `${c.platform}:${c.restaurant_id}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(c);
  }

  const result: UptimeHistory = {};

  for (const [key, keyChanges] of byKey.entries()) {
    const slotArr: UptimeSlot[] = new Array(slots).fill("unknown");

    // Walk backwards from now, filling slots based on status changes
    let currentState = latestState.get(key) ?? true;
    let cursor = nowMs;

    const events = [...(keyChanges ?? [])].reverse(); // newest first

    for (let i = slots - 1; i >= 0; i--) {
      const slotStart = nowMs - (slots - i) * 3600000;
      const slotEnd = slotStart + 3600000;

      // Apply any status changes that happened during this slot
      while (events.length > 0) {
        const t = new Date(events[0].changed_at).getTime();
        if (t >= slotStart && t < slotEnd) {
          // This change happened in this slot — state before change was prev_open
          currentState = events[0].curr_open;
          events.shift();
        } else if (t < slotStart) {
          currentState = events[0].curr_open;
          events.shift();
        } else {
          break;
        }
      }

      slotArr[i] = currentState ? "online" : "offline";
    }

    result[key] = slotArr;
  }

  return result;
}

export async function getLocationStatus(
  citySlug: string,
  locationSlug: string
): Promise<{
  restaurants: RestaurantStatus[];
  statusChanges: StatusChange[];
  alerts: Alert[];
  uptimeHistory: UptimeHistory;
} | null> {
  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select(
      "id,brand,location,location_slug,city,city_slug,swiggy_id,swiggy_slug,zomato_slug,operational_hours_swiggy,operational_hours_zomato,should_be_live_swiggy,should_be_live_zomato"
    )
    .eq("city_slug", citySlug)
    .eq("location_slug", locationSlug)
    .eq("active", true);

  if (error) throw new Error(`restaurants query failed: ${error.message}`);
  if (!restaurants?.length) return null;

  const snapMap = await getLatestSnapshots();

  const statuses: RestaurantStatus[] = restaurants.map((r) => {
    const restaurant = r as Restaurant;
    return {
      restaurant,
      swiggy: restaurant.swiggy_id
        ? (snapMap.get(`swiggy:${restaurant.swiggy_id}`) ?? null)
        : null,
      zomato: restaurant.zomato_slug
        ? (snapMap.get(`zomato:${restaurant.zomato_slug}`) ?? null)
        : null,
    };
  });

  // Restaurant IDs for this location
  const restaurantIds = [
    ...restaurants.flatMap((r) =>
      [r.swiggy_id, r.zomato_slug].filter(Boolean)
    ),
  ] as string[];

  const [{ data: statusChanges }, { data: alerts }, uptimeHistory] = await Promise.all([
    supabase
      .from("status_changes")
      .select("id,platform,prev_open,curr_open,changed_at,restaurant_id")
      .in("restaurant_id", restaurantIds)
      .order("changed_at", { ascending: false })
      .limit(20),
    supabase
      .from("alerts")
      .select("id,platform,alert_type,details,created_at,acknowledged_at")
      .in("restaurant_id", restaurantIds)
      .is("acknowledged_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
    getUptimeHistory(restaurantIds),
  ]);

  return {
    restaurants: statuses,
    statusChanges: (statusChanges ?? []) as StatusChange[],
    alerts: (alerts ?? []) as Alert[],
    uptimeHistory,
  };
}

// Categories that are platform-curated/algorithmic — not part of a brand's fixed menu.
// Items in these categories differ per platform by design, so we skip them in cross-platform comparison.
const RECOMMENDED_CATEGORIES = new Set([
  "recommended", "bestseller", "bestsellers", "most ordered", "top picks",
  "popular", "trending", "featured", "must try", "chef's special",
  "chef's choice", "top rated", "special", "combos", "add-ons", "add ons",
]);

function isRecommendedCategory(cat: string | null): boolean {
  if (!cat) return false;
  return RECOMMENDED_CATEGORIES.has(cat.toLowerCase().trim());
}

function normalizeItemName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

export type MenuItemFlag = {
  name: string;
  category: string | null;
  onSwiggy: boolean;
  onZomato: boolean;
};

export type BrandMenuComparison = {
  restaurantId: number;
  brand: string;
  location: string;
  city: string;
  swiggyId: string | null;
  zomatoSlug: string | null;
  swiggyTotal: number;
  zomatoTotal: number;
  missingFromZomato: MenuItemFlag[];
  missingFromSwiggy: MenuItemFlag[];
  inBoth: number;
  hasDiscrepancy: boolean;
};

export async function getMenuComparison(): Promise<BrandMenuComparison[]> {
  // Fetch all active restaurants
  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select("id,brand,location,city,swiggy_id,swiggy_slug,zomato_slug,should_be_live_swiggy,should_be_live_zomato")
    .eq("active", true)
    .order("brand");

  if (error) throw new Error(`restaurants query failed: ${error.message}`);

  // Collect all restaurant IDs for batch snapshot lookup
  const swiggyIds = (restaurants ?? []).map(r => r.swiggy_id).filter(Boolean) as string[];
  const zomatoIds = (restaurants ?? []).map(r => r.zomato_slug).filter(Boolean) as string[];
  const allIds = [...swiggyIds, ...zomatoIds];
  if (!allIds.length) return [];

  // Get latest snapshot IDs per platform+restaurant
  const { data: snapshots } = await supabase
    .from("snapshots")
    .select("id,platform,restaurant_id,fetched_at")
    .in("restaurant_id", allIds)
    .order("fetched_at", { ascending: false });

  // Keep only the latest snapshot per (platform, restaurant_id)
  const latestSnap = new Map<string, number>(); // key → snapshot_id
  for (const s of snapshots ?? []) {
    const key = `${s.platform}:${s.restaurant_id}`;
    if (!latestSnap.has(key)) latestSnap.set(key, s.id);
  }

  const snapIds = [...latestSnap.values()];
  if (!snapIds.length) return [];

  // Fetch all menu items for those snapshots
  const { data: items } = await supabase
    .from("menu_items")
    .select("snapshot_id,name,category,in_stock,is_enabled")
    .in("snapshot_id", snapIds);

  // Build item sets per (platform, restaurant_id) — fixed menu only
  const itemsBySnap = new Map<number, Array<{ name: string; category: string | null }>>();
  for (const item of items ?? []) {
    if (!item.name) continue;
    if (isRecommendedCategory(item.category)) continue;
    if (!item.is_enabled) continue;
    if (!itemsBySnap.has(item.snapshot_id)) itemsBySnap.set(item.snapshot_id, []);
    itemsBySnap.get(item.snapshot_id)!.push({ name: item.name, category: item.category });
  }

  // Compare per restaurant
  const results: BrandMenuComparison[] = [];

  for (const r of restaurants ?? []) {
    if (!r.swiggy_id || !r.zomato_slug) continue;
    if (!r.should_be_live_swiggy || !r.should_be_live_zomato) continue;

    const swiggySnapId = latestSnap.get(`swiggy:${r.swiggy_id}`);
    const zomatoSnapId = latestSnap.get(`zomato:${r.zomato_slug}`);
    if (!swiggySnapId || !zomatoSnapId) continue;

    const swiggyItems = itemsBySnap.get(swiggySnapId) ?? [];
    const zomatoItems = itemsBySnap.get(zomatoSnapId) ?? [];

    // Build normalized name maps
    const swiggyMap = new Map<string, { name: string; category: string | null }>();
    for (const i of swiggyItems) swiggyMap.set(normalizeItemName(i.name), i);

    const zomatoMap = new Map<string, { name: string; category: string | null }>();
    for (const i of zomatoItems) zomatoMap.set(normalizeItemName(i.name), i);

    const missingFromZomato: MenuItemFlag[] = [];
    const missingFromSwiggy: MenuItemFlag[] = [];
    let inBoth = 0;

    for (const [norm, item] of swiggyMap) {
      if (zomatoMap.has(norm)) inBoth++;
      else missingFromZomato.push({ name: item.name, category: item.category, onSwiggy: true, onZomato: false });
    }
    for (const [norm, item] of zomatoMap) {
      if (!swiggyMap.has(norm))
        missingFromSwiggy.push({ name: item.name, category: item.category, onSwiggy: false, onZomato: true });
    }

    results.push({
      restaurantId: r.id,
      brand: r.brand,
      location: r.location,
      city: r.city,
      swiggyId: r.swiggy_id,
      zomatoSlug: r.zomato_slug,
      swiggyTotal: swiggyItems.length,
      zomatoTotal: zomatoItems.length,
      missingFromZomato,
      missingFromSwiggy,
      inBoth,
      hasDiscrepancy: missingFromZomato.length > 0 || missingFromSwiggy.length > 0,
    });
  }

  return results.sort((a, b) => {
    const aIssue = a.hasDiscrepancy ? 0 : 1;
    const bIssue = b.hasDiscrepancy ? 0 : 1;
    return aIssue - bIssue || a.brand.localeCompare(b.brand);
  });
}
