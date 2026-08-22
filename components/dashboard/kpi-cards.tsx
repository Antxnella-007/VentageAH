import { Card, CardContent } from "@/components/ui/card";
import { formatPercent, formatUsd } from "@/lib/format";

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
  const items = [
    {
      label: "Total Spend",
      value: formatUsd(kpis.totalSpend),
      hint: `${formatPercent(kpis.totalSpendDelta)} this month`,
    },
    {
      label: "Pending Payments",
      value: formatUsd(kpis.pendingPayments),
      hint: "Awaiting treasury settlement",
    },
    {
      label: "Invoices Processed",
      value: kpis.invoicesProcessed.toLocaleString("en-US"),
      hint: "Local document intelligence",
    },
    {
      label: "Detected Anomalies",
      value: String(kpis.anomalies),
      hint: kpis.anomalies ? "Requires finance review" : "Within expected range",
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
            <p className="mt-2 text-xs text-muted-foreground">{item.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
