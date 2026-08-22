"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { InvoiceStatus } from "@/components/dashboard/recent-invoices";
import { formatDate, formatUsd } from "@/lib/format";
import { MAX_BATCH_FILES, validateUploadFile } from "@/lib/validators";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  supplier: string;
  branch: string;
  date: string;
  total: number;
  currency: string;
  status: string;
  originalFilename?: string | null;
  reconciliationStatus?: string | null;
  flagReason?: string | null;
};

export function InvoiceWorkspace({ initialInvoices }: { initialInvoices: InvoiceRow[] }) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const grouped = useMemo(() => invoices.slice(0, 40), [invoices]);

  async function refresh() {
    const res = await fetch("/api/invoices");
    if (!res.ok) return;
    const data = (await res.json()) as { invoices: InvoiceRow[] };
    setInvoices(data.invoices);
    return data.invoices;
  }

  async function processIds(ids: string[]) {
    setBusy(true);
    setProgress({ done: 0, total: ids.length });
    const poll = window.setInterval(async () => {
      const latest = await refresh();
      if (!latest) return;
      const finished = latest.filter(
        (item) => ids.includes(item.id) && ["PROCESSED", "FLAGGED", "ERROR"].includes(item.status),
      ).length;
      setProgress({ done: finished, total: ids.length });
    }, 400);

    try {
      const res = await fetch("/api/invoices/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Processing failed.");
      }
      toast.success("Invoices processed locally with QVAC.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Processing failed.");
    } finally {
      window.clearInterval(poll);
      await refresh();
      setProgress(null);
      setBusy(false);
    }
  }

  async function uploadFiles(fileList: File[]) {
    if (fileList.length === 0) return;
    if (fileList.length > MAX_BATCH_FILES) {
      toast.error("A batch can include up to 30 invoices.");
      return;
    }
    for (const file of fileList) {
      const check = validateUploadFile(file);
      if (!check.ok) {
        toast.error(check.error);
        return;
      }
    }

    const form = new FormData();
    fileList.forEach((file) => form.append("files", file));
    setBusy(true);
    try {
      const res = await fetch("/api/invoices/upload", { method: "POST", body: form });
      const body = (await res.json()) as { error?: string; ids?: string[] };
      if (!res.ok) throw new Error(body.error ?? "Upload failed.");
      await refresh();
      if (body.ids) await processIds(body.ids);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
      setBusy(false);
    }
  }

  async function loadDemoBatch() {
    setBusy(true);
    try {
      const res = await fetch("/api/invoices/demo-batch", { method: "POST" });
      const body = (await res.json()) as { error?: string; ids?: string[] };
      if (!res.ok) throw new Error(body.error ?? "Demo batch failed.");
      await refresh();
      if (body.ids) await processIds(body.ids);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Demo batch failed.");
      setBusy(false);
    }
  }

  const percent = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Process invoices locally with QVAC. Financial documents never need to leave your infrastructure.
        </p>
      </div>

      <Card
        className={`border-dashed ${dragOver ? "border-navy bg-slate-50" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void uploadFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-lg font-medium">Drop invoices here</p>
          <p className="text-sm text-muted-foreground">Process invoices locally with QVAC · PNG, JPG, JPEG, PDF · up to 30 files · 10 MB each</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => inputRef.current?.click()} disabled={busy}>
              Select files
            </Button>
            <Button variant="outline" onClick={() => void loadDemoBatch()} disabled={busy}>
              Load 24 sample invoices
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
            multiple
            className="hidden"
            onChange={(event) => {
              void uploadFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </CardContent>
      </Card>

      {(busy || progress) && (
        <Card>
          <CardHeader>
            <CardTitle>Processing locally with QVAC</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-sm text-muted-foreground">
              {progress ? `${progress.done} / ${progress.total} invoices` : "Preparing batch…"}
              {progress ? ` · ${percent}%` : ""}
            </p>
            <Progress value={percent} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invoice register</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet. Upload a batch to begin local processing.</p>
          ) : (
            grouped.map((invoice) => (
              <div key={invoice.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {invoice.supplier} · {invoice.branch} · {formatDate(invoice.date)}
                  </p>
                  {invoice.flagReason ? (
                    <p className="text-xs text-red-700">{invoice.flagReason}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{formatUsd(invoice.total)}</span>
                  <InvoiceStatus status={invoice.status} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
