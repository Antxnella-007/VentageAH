import { AnomalyPanel } from "@/components/dashboard/anomaly-panel";
import { BranchChart } from "@/components/dashboard/branch-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { PendingBatchCard } from "@/components/dashboard/pending-batch-card";
import { RecentInvoices } from "@/components/dashboard/recent-invoices";
import { PrivacyCard } from "@/components/shared/privacy-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardPayload } from "@/lib/dashboard";
import { formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardPayload();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Executive overview</h1>
        <p className="text-sm text-muted-foreground">
          Company-wide treasury intelligence for Vantage Holdings. Processed locally with QVAC.
        </p>
      </div>

      <KpiCards kpis={data.kpis} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Branch spending</CardTitle>
          </CardHeader>
          <CardContent>
            <BranchChart data={data.branchSpend} />
            <p className="mt-2 text-xs text-muted-foreground">
              Anomalous branches are highlighted. Cartago is flagged when spend exceeds 25% of its historical baseline.
            </p>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <PrivacyCard />
          <Card>
            <CardHeader>
              <CardTitle>Invoice reconciliation health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-3xl font-semibold text-navy">{formatPercent(data.kpis.reconciliationRate, 1).replace("+", "")}</p>
              <p className="text-muted-foreground">Matched to purchase orders this period.</p>
              <p>Local AI processing {data.kpis.localAiProcessing}%</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AnomalyPanel anomalies={data.anomalies} />
        <PendingBatchCard batch={data.pendingBatch} />
      </div>

      <RecentInvoices invoices={data.recentInvoices} />
    </div>
  );
}
