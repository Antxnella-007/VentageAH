"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUsdt, shortHash } from "@/lib/format";
import { interpolate, useI18n } from "@/components/shared/i18n-provider";

type Payment = {
  id: string;
  supplier: string;
  destinationAddress: string;
  amount: number;
  currency: string;
  status: string;
  transactionHash?: string | null;
};

type Batch = {
  id: string;
  batchNumber: string;
  name: string;
  totalAmount: number;
  currency: string;
  status: string;
  suppliers: number;
  approvals: { role: string; approverName: string }[];
  payments: Payment[];
};

type TreasuryPayload = {
  balance: { amount: number; token: string };
  address: string;
  wdk: { status: string; detail: string };
  pendingCount: number;
  scheduledCount: number;
  completedCount: number;
  batches: Batch[];
};

export function TreasuryWorkspace({ initial }: { initial: TreasuryPayload }) {
  const { t } = useI18n();
  const [data, setData] = useState(initial);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const batch = data.batches[0];

  async function refresh() {
    const res = await fetch("/api/treasury");
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    if (batch?.status !== "EXECUTING") return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 400);
    return () => window.clearInterval(timer);
  }, [batch?.status]);

  async function approve() {
    if (!batch) return;
    setBusy(true);
    try {
      const res = await fetch("/api/treasury/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: batch.id }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? t.treasury.toastNeedRole);
      toast.success(t.treasury.toastApproved);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.treasury.toastNeedRole);
    } finally {
      setBusy(false);
    }
  }

  async function execute() {
    if (!batch) return;
    setBusy(true);
    setConfirmOpen(false);
    try {
      const poll = window.setInterval(() => {
        void refresh();
      }, 400);
      const res = await fetch("/api/treasury/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: batch.id }),
      });
      window.clearInterval(poll);
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? t.treasury.toastExecuted);
      toast.success(t.treasury.toastExecuted);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.treasury.toastExecuted);
    } finally {
      setBusy(false);
    }
  }

  const cfo = batch?.approvals.find((item) => item.role === "CFO");
  const controller = batch?.approvals.find((item) => item.role === "Controller");
  const ready = batch?.status === "READY";

  function paymentStatus(status: string) {
    if (status === "PROCESSING") return t.treasury.processing;
    if (status === "PREVIEWED") return t.treasury.dryRun;
    if (status === "CONFIRMED") return t.treasury.confirmed;
    if (status === "FAILED") return t.treasury.failed;
    if (status === "PENDING") return t.treasury.pending;
    return status;
  }

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">{t.treasury.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.treasury.intro}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label={t.treasury.balance} value={formatUsdt(data.balance.amount)} />
        <Stat label={t.treasury.pendingBatches} value={String(data.pendingCount)} />
        <Stat label={t.treasury.scheduled} value={String(data.scheduledCount)} />
        <Stat label={t.treasury.completed} value={String(data.completedCount)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t.treasury.wallet}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">{t.treasury.addressHint}</span>
              <br />
              <span className="font-mono text-xs">{data.address}</span>
            </p>
            <p>
              {t.treasury.wdkStatus}: <Badge variant="secondary">{data.wdk.status}</Badge>
            </p>
            <p className="text-xs text-amber-700">{t.treasury.testAddresses}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.treasury.governance}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">{t.treasury.governanceBody}</CardContent>
        </Card>
      </div>

      {batch ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>{batch.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t.treasury.batchId} {batch.batchNumber} · {batch.suppliers} · {formatUsdt(batch.totalAmount)}
              </p>
            </div>
            <Badge>{batch.status.replaceAll("_", " ")}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <p className="text-sm">
                {t.treasury.approvals}: {batch.approvals.length} / 2
              </p>
              <p className="text-sm">
                {t.dashboard.cfo}: {cfo ? `${t.dashboard.approved} (${cfo.approverName})` : t.dashboard.pending}
              </p>
              <p className="text-sm">
                {t.dashboard.controller}:{" "}
                {controller ? `${t.dashboard.approved} (${controller.approverName})` : t.dashboard.pending}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void approve()} disabled={busy || batch.status === "COMPLETED" || batch.status === "EXECUTING"}>
                {t.treasury.approve}
              </Button>
              <Button variant="outline" disabled={!ready || busy} onClick={() => setConfirmOpen(true)}>
                {t.treasury.execute}
              </Button>
            </div>
            <div className="space-y-2">
              {batch.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col gap-1 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{payment.supplier}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{payment.destinationAddress}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>{formatUsdt(payment.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {paymentStatus(payment.status)}
                      {payment.transactionHash ? ` · ${shortHash(payment.transactionHash)}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">{t.treasury.noBatch}</CardContent>
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.treasury.confirmTitle}</DialogTitle>
            <DialogDescription>
              {interpolate(t.treasury.confirmBody, {
                count: batch?.suppliers ?? 0,
                amount: formatUsdt(batch?.totalAmount ?? 0),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t.treasury.cancel}
            </Button>
            <Button onClick={() => void execute()} disabled={busy}>
              {t.treasury.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-navy">{value}</p>
      </CardContent>
    </Card>
  );
}
