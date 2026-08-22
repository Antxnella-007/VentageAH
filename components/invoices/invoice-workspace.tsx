"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { InvoiceStatus } from "@/components/dashboard/recent-invoices";
import { formatDate, formatUsd } from "@/lib/format";
import { MAX_BATCH_FILES, validateUploadFile } from "@/lib/validators";
import { useI18n } from "@/components/shared/i18n-provider";
import { cn } from "@/lib/utils";
import type { InvoiceAnalysis } from "@/lib/gemini";

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
  flagReason?: string | null;
  brief?: string | null;
};

type AnalyzeResult = {
  id: string;
  extraction: {
    method: string;
    originalLength: number;
    sentLength: number;
    preview: string;
  };
  model: string;
  usedFallback: boolean;
  riskScore: number;
  analysis: InvoiceAnalysis;
  invoice: InvoiceRow & { brief?: string | null };
};

export function InvoiceWorkspace({ initialInvoices }: { initialInvoices: InvoiceRow[] }) {
  const { t } = useI18n();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<AnalyzeResult[]>([]);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const newIds = results.map((item) => item.id);

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
    return [...filtered].sort((a, b) => Number(newIds.includes(b.id)) - Number(newIds.includes(a.id)));
  }, [invoices, query, newIds]);

  async function refresh() {
    const res = await fetch("/api/invoices");
    if (!res.ok) return;
    const data = (await res.json()) as { invoices: InvoiceRow[] };
    setInvoices(data.invoices);
  }

  async function analyzeFiles(fileList: File[]) {
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
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const body = (await res.json()) as { error?: string; results?: AnalyzeResult[] };
      if (!res.ok) throw new Error(body.error ?? t.invoices.toastFail);
      setResults(body.results ?? []);
      await refresh();
      toast.success(t.invoices.toastOk);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.invoices.toastFail);
    } finally {
      setBusy(false);
    }
  }

  async function loadSample() {
    const res = await fetch("/sample-invoice.txt");
    const blob = await res.blob();
    const file = new File([blob], "sample-cloudnet-cartago.txt", { type: "text/plain" });
    await analyzeFiles([file]);
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-navy px-6 py-10 text-white shadow-xl md:px-10">
        <p className="text-xs font-semibold tracking-[0.28em] text-sky-200">VANTAGE · AP INTEL</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">{t.invoices.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{t.invoices.intro}</p>
        <div className="mt-6 flex flex-wrap gap-3 text-xs text-sky-100">
          <span className="rounded-full bg-white/10 px-3 py-1">1. Texto plano local</span>
          <span className="rounded-full bg-white/10 px-3 py-1">2. Gemini compacto</span>
          <span className="rounded-full bg-white/10 px-3 py-1">3. Brief + riesgos + sucursal</span>
        </div>
      </div>

      <Card
        className={cn(
          "border-2 border-dashed shadow-sm",
          dragOver ? "border-navy bg-sky-50" : "border-slate-300",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void analyzeFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-xl font-medium">{t.invoices.drop}</p>
          <p className="max-w-lg text-sm text-muted-foreground">{t.invoices.dropHint}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? t.invoices.processing : t.invoices.select}
            </Button>
            <Button size="lg" variant="outline" onClick={() => void loadSample()} disabled={busy}>
              {t.invoices.sample}
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.csv,.json,.docx,image/png,image/jpeg,application/pdf,text/plain"
            multiple
            className="hidden"
            onChange={(event) => {
              void analyzeFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </CardContent>
      </Card>

      {results.map((result) => (
        <AnalysisPanel key={result.id} result={result} />
      ))}

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
            visible.slice(0, 40).map((invoice) => {
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

function AnalysisPanel({ result }: { result: AnalyzeResult }) {
  const { analysis, extraction, riskScore, model, usedFallback } = result;
  return (
    <Card className="overflow-hidden border-navy/20 shadow-lg">
      <div className="bg-gradient-to-r from-navy to-[#163056] px-6 py-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-sky-200">{analysis.supplier}</p>
            <h2 className="mt-1 text-2xl font-semibold">{analysis.invoiceNumber}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">{analysis.brief}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
            <p className="text-xs text-slate-300">Total</p>
            <p className="text-2xl font-semibold">
              {analysis.total != null ? formatUsd(analysis.total) : "—"} {analysis.currency}
            </p>
            <p className="text-xs text-amber-200">Riesgo {riskScore}/100</p>
          </div>
        </div>
      </div>
      <CardContent className="grid gap-4 p-6 lg:grid-cols-3">
        <Info
          label="Sucursal sugerida"
          value={analysis.branchGuess ?? "Sin asignar"}
        />
        <Info label="Vencimiento" value={analysis.dueDate ?? "—"} />
        <Info label="Impuestos" value={analysis.taxAmount != null ? formatUsd(analysis.taxAmount) : "—"} />
        <Info label="Términos" value={analysis.paymentTerms ?? "—"} />
        <Info label="Categoría" value={analysis.category ?? "—"} />
        <Info label="Centro de costo" value={analysis.costCenterGuess ?? "—"} />
        <div className="lg:col-span-3 rounded-xl bg-slate-50 p-4 text-xs text-muted-foreground">
          Motor: {usedFallback ? "heurística local" : model} · {extraction.method} · {extraction.sentLength} /{" "}
          {extraction.originalLength} caracteres enviados a Gemini (texto plano, no la imagen completa).
        </div>
        <div className="lg:col-span-2 space-y-2">
          <p className="text-sm font-semibold">Preguntas para AP (lo que otros analizadores no hacen)</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {(analysis.questionsForAp.length ? analysis.questionsForAp : ["Revisar el total con el proveedor."]).map(
              (item) => (
                <li key={item}>{item}</li>
              ),
            )}
          </ul>
          <p className="pt-2 text-sm font-semibold">Chequeos del controller</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {analysis.controllerChecks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Riesgos</p>
          {analysis.risks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin banderas fuertes.</p>
          ) : (
            analysis.risks.map((risk) => (
              <div key={risk.code + risk.detail} className="rounded-lg border border-border p-3">
                <Badge variant={risk.severity === "high" ? "destructive" : "secondary"}>{risk.severity}</Badge>
                <p className="mt-1 text-sm">{risk.detail}</p>
              </div>
            ))
          )}
          <p className="text-xs text-muted-foreground">{analysis.cashImpact}</p>
        </div>
        {analysis.lineItems.length > 0 ? (
          <div className="lg:col-span-3">
            <p className="mb-2 text-sm font-semibold">Líneas</p>
            <div className="space-y-1 text-sm">
              {analysis.lineItems.slice(0, 12).map((line) => (
                <div key={line.description} className="flex justify-between gap-4 border-b border-border/60 py-1">
                  <span>{line.description}</span>
                  <span className="text-muted-foreground">
                    {line.qty ?? "—"} · {line.amount != null ? formatUsd(line.amount) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
