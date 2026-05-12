import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocationStatus, type Snapshot, type StatusChange, type Alert } from "@/lib/fleet";
import { formatDistanceToNow, format } from "date-fns";

export const revalidate = 60;

type Props = {
  params: Promise<{ city: string; location: string }>;
};

function PlatformStatus({ platform, snap, shouldBeLive }: {
  platform: "swiggy" | "zomato";
  snap: Snapshot | null;
  shouldBeLive: boolean;
}) {
  if (!shouldBeLive) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 opacity-60">
        <div className="text-sm font-semibold capitalize text-gray-400">{platform}</div>
        <div className="text-xs text-gray-400 mt-1">Not expected to be live</div>
      </div>
    );
  }

  if (!snap) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-gray-300" />
          <span className="text-sm font-semibold capitalize text-gray-500">{platform}</span>
        </div>
        <div className="text-xs text-gray-400">No data in last 2h</div>
      </div>
    );
  }

  const open = snap.is_open;
  return (
    <div className={`rounded-lg border p-4 ${open ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-3 h-3 rounded-full ${open ? "bg-green-500" : "bg-red-500"}`} />
        <span className="text-sm font-semibold capitalize">{platform}</span>
        <span className={`ml-auto text-xs font-bold uppercase ${open ? "text-green-700" : "text-red-700"}`}>
          {open ? "ONLINE" : "OFFLINE"}
        </span>
      </div>
      <div className="text-xs text-gray-500">
        Last checked {formatDistanceToNow(new Date(snap.fetched_at), { addSuffix: true })}
      </div>
    </div>
  );
}

function StatusChangeRow({ change }: { change: StatusChange }) {
  const online = change.curr_open;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? "bg-green-500" : "bg-red-500"}`} />
      <span className="text-xs font-medium capitalize text-gray-700">{change.platform}</span>
      <span className={`text-xs font-semibold ${online ? "text-green-700" : "text-red-700"}`}>
        {online ? "came online" : "went offline"}
      </span>
      <span className="ml-auto text-xs text-gray-400">
        {formatDistanceToNow(new Date(change.changed_at), { addSuffix: true })}
      </span>
    </div>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  return (
    <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-amber-600 font-semibold capitalize">{alert.platform}</span>
        <span className="text-xs text-amber-500 capitalize">{alert.alert_type.replace(/_/g, " ")}</span>
        <span className="ml-auto text-xs text-gray-400">
          {format(new Date(alert.created_at), "dd MMM HH:mm")}
        </span>
      </div>
      <p className="text-xs text-gray-600">{alert.details}</p>
    </div>
  );
}

export default async function LocationPage({ params }: Props) {
  const { city, location } = await params;
  const data = await getLocationStatus(city, location);

  if (!data) notFound();

  const { restaurants, statusChanges, alerts } = data;
  const firstR = restaurants[0].restaurant;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
            ← All locations
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{firstR.location}</h1>
          <p className="text-sm text-gray-500">{firstR.city}</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Active alerts */}
        {alerts.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wider mb-3">
              Active Alerts ({alerts.length})
            </h2>
            <div className="space-y-2">
              {alerts.map((a) => <AlertRow key={a.id} alert={a} />)}
            </div>
          </section>
        )}

        {/* Per-brand status */}
        {restaurants.map(({ restaurant, swiggy, zomato }) => (
          <section key={restaurant.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">{restaurant.brand}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PlatformStatus
                platform="swiggy"
                snap={swiggy}
                shouldBeLive={restaurant.should_be_live_swiggy}
              />
              <PlatformStatus
                platform="zomato"
                snap={zomato}
                shouldBeLive={restaurant.should_be_live_zomato}
              />
            </div>
            {(restaurant.operational_hours_swiggy || restaurant.operational_hours_zomato) && (
              <div className="mt-3 text-xs text-gray-500 flex gap-4 flex-wrap">
                {restaurant.operational_hours_swiggy && (
                  <span>Swiggy hours: {restaurant.operational_hours_swiggy}</span>
                )}
                {restaurant.operational_hours_zomato && (
                  <span>Zomato hours: {restaurant.operational_hours_zomato}</span>
                )}
              </div>
            )}
          </section>
        ))}

        {/* Status change history */}
        {statusChanges.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Recent Status Changes
            </h2>
            <div>
              {statusChanges.map((sc) => <StatusChangeRow key={sc.id} change={sc} />)}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
