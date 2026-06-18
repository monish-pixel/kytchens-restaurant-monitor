import { getMenuComparison } from "@/lib/fleet";
import MenuCheckDashboard from "@/components/MenuCheckDashboard";

export const revalidate = 1800; // 30 min — matches scraper cadence; menus only change when scraper runs

export default async function MenuCheckPage() {
  const comparisons = await getMenuComparison();
  return <MenuCheckDashboard comparisons={comparisons} />;
}
