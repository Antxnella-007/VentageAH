"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/shared/i18n-provider";

export function PendingBatchCard({
  batch,
}: {
  batch: {
    id: string;
    batchNumber: string;
    name: string;
    suppliers: number;
    totalAmount: number;
    currency: string;
    approvals: { role: string; approverName: string }[];
    required: number;
  } | null;
}) {
  const { t } = useI18n();

  if (!batch) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.pendingBatch}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{t.dashboard.noBatch}</CardContent>
      </Card>
    );
  }

  const cfo = batch.approvals.find((item) => item.role === "CFO");
  const controller = batch.approvals.find((item) => item.role === "Controller");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>{t.dashboard.pendingBatch}</CardTitle>
          <p className="text-sm text-muted-foreground">{batch.name}</p>
        </div>
        <Link href="/treasury" className={cn(buttonVariants())}>
          {t.dashboard.reviewBatch}
        </Link>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Metric label={t.dashboard.suppliers} value={String(batch.suppliers)} />
        <Metric label={t.dashboard.total} value={formatUsdt(batch.totalAmount)} />
        <Metric
          label={t.dashboard.approvalStatus}
          value={`${batch.approvals.length} / ${batch.required}`}
        />
        <Metric label={t.dashboard.batchId} value={batch.batchNumber} />
        <p className="text-sm">
          {t.dashboard.cfo}:{" "}
          <span className={cfo ? "font-medium text-emerald-700" : "text-amber-700"}>
            {cfo ? t.dashboard.approved : t.dashboard.pending}
          </span>
        </p>
        <p className="text-sm">
          {t.dashboard.controller}:{" "}
          <span className={controller ? "font-medium text-emerald-700" : "text-amber-700"}>
            {controller ? t.dashboard.approved : t.dashboard.pending}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
