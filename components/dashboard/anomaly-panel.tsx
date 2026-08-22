"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { interpolate, useI18n } from "@/components/shared/i18n-provider";
import type { AnomalyInsight } from "@/types";

export function AnomalyPanel({ anomalies }: { anomalies: AnomalyInsight[] }) {
  const { t } = useI18n();

  if (anomalies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.anomaliesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{t.dashboard.anomaliesEmpty}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{t.dashboard.anomaliesTitle}</CardTitle>
        <Link href="/invoices" className={cn(buttonVariants())}>
          {t.dashboard.reviewInvoices}
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {anomalies.map((item) => (
          <div key={item.branch} className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{item.branch}</p>
              <Badge variant="destructive">
                {t.dashboard.severity}: {item.severity}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-red-700">
              {formatPercent(item.deviationPercent)} {t.dashboard.aboveExpected}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{item.explanation}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {interpolate(t.dashboard.currentVs, {
                current: formatUsd(item.currentSpend),
                baseline: formatUsd(item.historicalAverage),
              })}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
