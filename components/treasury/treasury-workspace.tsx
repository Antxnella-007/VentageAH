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
      if (!res.ok) throw new Error(body.error ?? "Approval failed.");
      toast.success("Approval recorded by Vantage governance.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Approval failed.");
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
      const body = (await res.json()) as { error?: string; status?: string };
      if (!res.ok) throw new Error(body.error ?? "Execution failed.");
      toast.success(
        body.status === "COMPLETED"
          ? "Batch finished. Dry run / demo transactions were recorded."
          : "Batch finished with exceptions.",
      );
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Execution failed.");
    } finally {
      setBusy(false);
    }
  }

  const cfo = batch?.approvals.find((item) => item.role === "CFO");
  const controller = batch?.approvals.find((item) => item.role === "Controller");
  const ready = batch?.status === "READY";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Treasury</h1>
        <p className="text-sm text-muted-foreground">
          Vantage orchestrates approvals. WDK settles USDT from the server side. Wallet secrets never reach this browser.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Treasury Balance" value={formatUsdt(data.balance.amount)} />
        <Stat label="Pending Batches" value={String(data.pendingCount)} />
        <Stat label="Scheduled Payments" value={String(data.scheduledCount)} />
        <Stat label="Completed Payments" value={String(data.completedCount)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Treasury wallet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Address · test/demo identifier</span>
              <br />
              <span className="font-mono text-xs">{data.address}</span>
            </p>
            <p>
              WDK status: <Badge variant="secondary">{data.wdk.status}</Badge>
            </p>
            <p className="text-xs text-muted-foreground">{data.wdk.detail}</p>
            <p className="text-xs text-amber-700">These destination addresses are test identifiers, not production supplier wallets.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Governance</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Dual control is implemented by Vantage, not by WDK. A batch requires CFO and Controller approvals before Execute Payments is enabled.
          </CardContent>
        </Card>
      </div>

      {batch ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>{batch.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Batch ID {batch.batchNumber} · {batch.suppliers} suppliers · {formatUsdt(batch.totalAmount)}
              </p>
            </div>
            <Badge>{batch.status.replaceAll("_", " ")}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <p className="text-sm">Approvals: {batch.approvals.length} / 2</p>
              <p className="text-sm">CFO: {cfo ? `Approved (${cfo.approverName})` : "Pending"}</p>
              <p className="text-sm">Controller: {controller ? `Approved (${controller.approverName})` : "Pending"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void approve()} disabled={busy || batch.status === "COMPLETED" || batch.status === "EXECUTING"}>
                Approve as current role
              </Button>
              <Button
                variant="outline"
                disabled={!ready || busy}
                onClick={() => setConfirmOpen(true)}
              >
                Execute Payments
              </Button>
            </div>
            <div className="space-y-2">
              {batch.payments.map((payment) => (
                <div key={payment.id} className="flex flex-col gap-1 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{payment.supplier}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{payment.destinationAddress}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>{formatUsdt(payment.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {statusLabel(payment.status)}
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
          <CardContent className="py-8 text-sm text-muted-foreground">No treasury batches are available.</CardContent>
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm treasury execution</DialogTitle>
            <DialogDescription>
              You are about to execute {batch?.suppliers ?? 0} supplier payments totaling {formatUsdt(batch?.totalAmount ?? 0)}.
              Default configuration is WDK dry-run. This does not broadcast a live chain transaction unless dry-run is disabled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void execute()} disabled={busy}>
              Confirm execution
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

function statusLabel(status: string) {
  if (status === "PROCESSING") return "Processing...";
  if (status === "PREVIEWED") return "Dry run";
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "FAILED") return "Failed";
  if (status === "PENDING") return "Pending";
  return status;
}
