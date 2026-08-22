import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AnomalyInsight } from "@/types";

export function AnomalyPanel({ anomalies }: { anomalies: AnomalyInsight[] }) {
  if (anomalies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financial anomalies</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No branch spending anomalies were detected this period.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Financial anomalies</CardTitle>
        <Link href="/invoices" className={cn(buttonVariants())}>
          Review invoices
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {anomalies.map((item) => (
          <div key={item.branch} className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{item.branch}</p>
              <Badge variant="destructive">Severity: {capitalize(item.severity)}</Badge>
            </div>
            <p className="mt-1 text-sm text-red-700">
              {formatPercent(item.deviationPercent)} above expected spending
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{item.explanation}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Current {formatUsd(item.currentSpend)} versus baseline {formatUsd(item.historicalAverage)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
