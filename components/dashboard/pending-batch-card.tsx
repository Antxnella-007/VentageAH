import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdt } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  if (!batch) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Treasury Batch</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          There is no payment batch waiting for approval.
        </CardContent>
      </Card>
    );
  }

  const cfo = batch.approvals.find((item) => item.role === "CFO");
  const controller = batch.approvals.find((item) => item.role === "Controller");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Pending Treasury Batch</CardTitle>
          <p className="text-sm text-muted-foreground">{batch.name}</p>
        </div>
        <Link href="/treasury" className={cn(buttonVariants())}>
          Review batch
        </Link>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Metric label="Suppliers" value={String(batch.suppliers)} />
        <Metric label="Total" value={formatUsdt(batch.totalAmount)} />
        <Metric label="Approval status" value={`${batch.approvals.length} / ${batch.required} approvals`} />
        <Metric label="Batch ID" value={batch.batchNumber} />
        <p className="text-sm">
          CFO: <span className={cfo ? "font-medium text-emerald-700" : "text-amber-700"}>{cfo ? "Approved" : "Pending"}</span>
        </p>
        <p className="text-sm">
          Controller:{" "}
          <span className={controller ? "font-medium text-emerald-700" : "text-amber-700"}>
            {controller ? "Approved" : "Pending"}
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
