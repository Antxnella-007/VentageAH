"use client";

import { AnomalyPanel } from "@/components/dashboard/anomaly-panel";
import { BranchChart } from "@/components/dashboard/branch-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { PendingBatchCard } from "@/components/dashboard/pending-batch-card";
import { RecentInvoices } from "@/components/dashboard/recent-invoices";
import { PrivacyCard } from "@/components/shared/privacy-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/format";
import { useI18n } from "@/components/shared/i18n-provider";
import type { AnomalyInsight } from "@/types";

export function DashboardView({
  data,
}: {
  data: {
    kpis: {
      totalSpend: number;
      totalSpendDelta: number;
      pendingPayments: number;
      invoicesProcessed: number;
      anomalies: number;
      reconciliationRate: number;
      localAiProcessing: number;
    };
    branchSpend: {
      branch: string;
      currentSpend: number;
      historicalAverage: number;
      anomalous: boolean;
    }[];
    anomalies: AnomalyInsight[];
    pendingBatch: {
      id: string;
      batchNumber: string;
      name: string;
      suppliers: number;
      totalAmount: number;
      currency: string;
      approvals: { role: string; approverName: string }[];
      required: number;
    } | null;
    recentInvoices: {
      id: string;
      invoiceNumber: string;
      supplier: string;
      branch: string;
      amount: number;
      date: Date | string;
      status: string;
    }[];
  };
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">{t.dashboard.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.dashboard.intro}</p>
      </div>

      <KpiCards kpis={data.kpis} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t.dashboard.branchSpend}</CardTitle>
          </CardHeader>
          <CardContent>
            <BranchChart data={data.branchSpend} />
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t.dashboard.branchSpendHint}</p>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <PrivacyCard />
          <Card>
            <CardHeader>
              <CardTitle>{t.dashboard.reconTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-3xl font-semibold text-navy">
                {formatPercent(data.kpis.reconciliationRate, 1).replace("+", "")}
              </p>
              <p className="text-muted-foreground">{t.dashboard.reconHint}</p>
              <p>
                {t.dashboard.localAi} {data.kpis.localAiProcessing}%
              </p>
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
