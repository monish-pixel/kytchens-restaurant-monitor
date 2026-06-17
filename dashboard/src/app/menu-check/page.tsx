import { getMenuComparison } from "@/lib/fleet";
import MenuCheckDashboard from "@/components/MenuCheckDashboard";

export const revalidate = 300; // 5 min — menu changes are slow

export default async function MenuCheckPage() {
  const comparisons = await getMenuComparison();
  return <MenuCheckDashboard comparisons={comparisons} />;
}
