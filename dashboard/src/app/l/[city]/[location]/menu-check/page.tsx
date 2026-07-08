import { getMenuComparison } from "@/lib/fleet";
import MenuCheckDashboard from "@/components/MenuCheckDashboard";

export const revalidate = 60;

type Props = { params: Promise<{ city: string; location: string }> };

export default async function KitchenMenuCheckPage({ params }: Props) {
  const { city, location } = await params;
  const all = await getMenuComparison();
  const comparisons = all.filter(
    (c) => c.city_slug === city && c.location_slug === location
  );
  return <MenuCheckDashboard comparisons={comparisons} />;
}
