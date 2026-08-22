"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatPercent, formatUsd } from "@/lib/format";
import { useI18n } from "@/components/shared/i18n-provider";

export function KpiCards({
  kpis,
}: {
  kpis: {
    totalSpend: number;
    totalSpendDelta: number;
    pendingPayments: number;
    invoicesProcessed: number;
    anomalies: number;
    reconciliationRate: number;
    localAiProcessing: number;
  };
}) {
  const { t } = useI18n();
  const items = [
    {
      label: t.dashboard.totalSpend,
      value: formatUsd(kpis.totalSpend),
      hint: `${formatPercent(kpis.totalSpendDelta)} ${t.dashboard.thisMonth} · ${t.dashboard.totalSpendHint}`,
    },
    {
      label: t.dashboard.pendingPayments,
      value: formatUsd(kpis.pendingPayments),
      hint: t.dashboard.pendingPaymentsHint,
    },
    {
      label: t.dashboard.invoicesProcessed,
      value: kpis.invoicesProcessed.toLocaleString(),
      hint: t.dashboard.invoicesHint,
    },
    {
      label: t.dashboard.anomalies,
      value: String(kpis.anomalies),
      hint: kpis.anomalies ? t.dashboard.anomaliesHint : t.dashboard.anomaliesOk,
      alert: kpis.anomalies > 0,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {item.label}
            </p>
            <p className={`mt-2 text-3xl font-semibold ${item.alert ? "text-red-700" : "text-navy"}`}>
              {item.value}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
