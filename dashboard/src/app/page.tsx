import { getFleetStatus } from "@/lib/fleet";
import FleetDashboard, { type LocationData } from "@/components/FleetDashboard";

export const revalidate = 60;

export default async function FleetPage() {
  const { byCity, totalOnline, totalOffline, totalStale, lastFetchedAt } = await getFleetStatus();

  const locations: LocationData[] = [];

  for (const [city, cityData] of Object.entries(byCity)) {
    for (const [location, statuses] of Object.entries(cityData)) {
      const first = statuses[0].restaurant;
      let swiggyOfflineCount = 0;
      let zomatoOfflineCount = 0;
      let hasMismatch = false;

      for (const s of statuses) {
        const swiggyOpen = s.swiggy?.is_open ?? null;
        const zomatoOpen = s.zomato?.is_open ?? null;

        const zomatoActive = s.restaurant.should_be_live_zomato && !!s.restaurant.zomato_slug;
        if (s.restaurant.should_be_live_swiggy && swiggyOpen === false) swiggyOfflineCount++;
        if (zomatoActive && zomatoOpen === false) zomatoOfflineCount++;

        if (
          (s.restaurant.should_be_live_swiggy && swiggyOpen === false) ||
          (zomatoActive && zomatoOpen === false) ||
          (!s.restaurant.should_be_live_swiggy && swiggyOpen === true) ||
          (!zomatoActive && zomatoOpen === true)
        ) {
          hasMismatch = true;
        }
      }

      locations.push({
        city,
        citySlug: first.city_slug,
        location,
        locationSlug: first.location_slug,
        brands: statuses,
        swiggyOfflineCount,
        zomatoOfflineCount,
        hasMismatch,
      });
    }
  }

  const cities = [...new Set(locations.map((l) => l.city))].sort();

  return (
    <FleetDashboard
      locations={locations}
      cities={cities}
      totalOnline={totalOnline}
      totalOffline={totalOffline}
      totalStale={totalStale}
      lastFetchedAt={lastFetchedAt}
    />
  );
}
