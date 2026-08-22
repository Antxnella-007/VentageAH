import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDashboardPayload } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardPayload();
  return <DashboardView data={data} />;
}
