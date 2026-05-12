import Link from "next/link";
import { getFleetStatus, type RestaurantStatus } from "@/lib/fleet";
import { formatDistanceToNow } from "date-fns";

export const revalidate = 60;

function StatusDot({ open, stale }: { open: boolean | null; stale: boolean }) {
  if (stale) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300" title="No data" />;
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${open ? "bg-green-500" : "bg-red-500"}`}
      title={open ? "Online" : "Offline"}
    />
  );
}

function PlatformBadge({ label, snap, shouldBeLive }: {
  label: string;
  snap: RestaurantStatus["swiggy"] | RestaurantStatus["zomato"];
  shouldBeLive: boolean;
}) {
  if (!shouldBeLive) return null;
  const stale = !snap;
  const open = snap?.is_open ?? null;
  const ago = snap ? formatDistanceToNow(new Date(snap.fetched_at), { addSuffix: true }) : null;

  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-600">
      <StatusDot open={open} stale={stale} />
      <span className="font-medium">{label}</span>
      {ago && <span className="text-gray-400">{ago}</span>}
    </span>
  );
}

function LocationCard({ statuses, city, location }: {
  statuses: RestaurantStatus[];
  city: string;
  location: string;
}) {
  const first = statuses[0];
  const citySlug = first.restaurant.city_slug;
  const locationSlug = first.restaurant.location_slug;
  const anyOffline = statuses.some(
    (s) =>
      (s.swiggy && !s.swiggy.is_open && s.restaurant.should_be_live_swiggy) ||
      (s.zomato && !s.zomato.is_open && s.restaurant.should_be_live_zomato)
  );

  return (
    <Link
      href={`/l/${citySlug}/${locationSlug}`}
      className={`block rounded-lg border p-4 hover:border-gray-400 transition-colors ${
        anyOffline ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{city}</div>
      <div className="font-semibold text-gray-900 mb-2">{location}</div>
      <div className="space-y-2">
        {statuses.map((s) => (
          <div key={s.restaurant.id}>
            <div className="text-xs font-medium text-gray-700 mb-1">{s.restaurant.brand}</div>
            <div className="flex gap-3 flex-wrap">
              <PlatformBadge
                label="Swiggy"
                snap={s.swiggy}
                shouldBeLive={s.restaurant.should_be_live_swiggy}
              />
              <PlatformBadge
                label="Zomato"
                snap={s.zomato}
                shouldBeLive={s.restaurant.should_be_live_zomato}
              />
            </div>
          </div>
        ))}
      </div>
    </Link>
  );
}

export default async function FleetPage() {
  const { byCity, totalOnline, totalOffline, totalStale } = await getFleetStatus();
  const cities = Object.keys(byCity).sort();
  const total = totalOnline + totalOffline + totalStale;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Kytchens Fleet Monitor</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {total} restaurant listings · refreshes every 60s
            </p>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
              <span className="font-medium text-green-700">{totalOnline} online</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
              <span className="font-medium text-red-700">{totalOffline} offline</span>
            </span>
            {totalStale > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" />
                <span className="text-gray-500">{totalStale} stale</span>
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        {cities.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            No active restaurants found. Add entries to the Google Sheet and run a sync.
          </div>
        )}
        {cities.map((city) => {
          const locations = Object.keys(byCity[city]).sort();
          return (
            <section key={city}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {city}
              </h2>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {locations.map((location) => (
                  <LocationCard
                    key={location}
                    city={city}
                    location={location}
                    statuses={byCity[city][location]}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
