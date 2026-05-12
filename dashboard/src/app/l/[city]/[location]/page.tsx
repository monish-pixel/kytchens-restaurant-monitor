import { notFound } from "next/navigation";
import { getLocationStatus } from "@/lib/fleet";
import LocationDashboard from "@/components/LocationDashboard";

export const revalidate = 60;

type Props = {
  params: Promise<{ city: string; location: string }>;
};

export default async function LocationPage({ params }: Props) {
  const { city, location } = await params;
  const data = await getLocationStatus(city, location);

  if (!data) notFound();

  return (
    <LocationDashboard
      restaurants={data.restaurants}
      statusChanges={data.statusChanges}
      alerts={data.alerts}
    />
  );
}
