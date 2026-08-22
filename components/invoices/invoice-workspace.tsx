"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { InvoiceStatus } from "@/components/dashboard/recent-invoices";
import { formatDate, formatUsd } from "@/lib/format";
import { MAX_BATCH_FILES, validateUploadFile } from "@/lib/validators";
import { interpolate, useI18n } from "@/components/shared/i18n-provider";
import { cn } from "@/lib/utils";

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
  const { t } = useI18n();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? invoices.filter((invoice) =>
          [invoice.invoiceNumber, invoice.supplier, invoice.branch, invoice.originalFilename ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : invoices;
    return [...filtered].sort((a, b) => {
      const aNew = newIds.includes(a.id) ? 1 : 0;
      const bNew = newIds.includes(b.id) ? 1 : 0;
      if (aNew !== bNew) return bNew - aNew;
      return 0;
    });
  }, [invoices, query, newIds]);

  async function refresh() {
    const res = await fetch("/api/invoices");
    if (!res.ok) return;
    const data = (await res.json()) as { invoices: InvoiceRow[] };
    setInvoices(data.invoices);
    return data.invoices;
  }

  async function processIds(ids: string[]) {
    setBusy(true);
    setNewIds(ids);
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
        throw new Error(body.error ?? t.invoices.toastFail);
      }
      toast.success(t.invoices.toastOk);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.invoices.toastFail);
    } finally {
      window.clearInterval(poll);
      await refresh();
      setProgress((current) => (current ? { ...current, done: current.total } : current));
      setBusy(false);
    }
  }

  async function uploadFiles(fileList: File[]) {
    if (fileList.length === 0) return;
    if (fileList.length > MAX_BATCH_FILES) {
      toast.error(t.invoices.tooMany);
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
      if (!res.ok) throw new Error(body.error ?? t.invoices.uploadFail);
      await refresh();
      if (body.ids) await processIds(body.ids);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.invoices.uploadFail);
      setBusy(false);
    }
  }

  async function loadDemoBatch() {
    setBusy(true);
    try {
      const res = await fetch("/api/invoices/demo-batch", { method: "POST" });
      const body = (await res.json()) as { error?: string; ids?: string[] };
      if (!res.ok) throw new Error(body.error ?? t.invoices.toastFail);
      await refresh();
      if (body.ids) await processIds(body.ids);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.invoices.toastFail);
      setBusy(false);
    }
  }

  const percent = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0;
  const finished = Boolean(progress && !busy && progress.done >= progress.total);

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">{t.invoices.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.invoices.intro}</p>
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
          <p className="text-lg font-medium">{t.invoices.drop}</p>
          <p className="max-w-lg text-sm text-muted-foreground">{t.invoices.dropHint}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => inputRef.current?.click()} disabled={busy}>
              {t.invoices.select}
            </Button>
            <Button variant="outline" onClick={() => void loadDemoBatch()} disabled={busy}>
              {t.invoices.sample}
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
        <Card className={finished ? "border-emerald-200 bg-emerald-50/60" : ""}>
          <CardHeader>
            <CardTitle>{finished ? t.invoices.doneTitle : t.invoices.processing}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-sm text-muted-foreground">
              {finished
                ? interpolate(t.invoices.doneBody, { count: progress?.total ?? 0 })
                : progress
                  ? `${progress.done} ${t.invoices.of} ${progress.total} · ${percent}%`
                  : t.invoices.preparing}
            </p>
            <Progress value={percent} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="space-y-3">
          <div>
            <CardTitle>{t.invoices.register}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{t.invoices.registerHint}</p>
          </div>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.invoices.search}
            className="max-w-md bg-white"
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.invoices.empty}</p>
          ) : (
            visible.slice(0, 50).map((invoice) => {
              const isNew = newIds.includes(invoice.id);
              return (
                <div
                  key={invoice.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
                    isNew ? "border-navy bg-sky-50 shadow-sm" : "border-border",
                  )}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                      {isNew ? (
                        <span className="rounded-full bg-navy px-2 py-0.5 text-[11px] font-medium text-white">
                          {t.invoices.newBadge}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {invoice.supplier} · {invoice.branch} · {formatDate(invoice.date)}
                    </p>
                    {invoice.originalFilename ? (
                      <p className="text-xs text-muted-foreground">
                        {t.invoices.fromFile}: {invoice.originalFilename}
                      </p>
                    ) : null}
                    {invoice.flagReason ? (
                      <p className="mt-1 text-xs text-red-700">{invoice.flagReason}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{formatUsd(invoice.total)}</span>
                    <InvoiceStatus status={invoice.status} />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
