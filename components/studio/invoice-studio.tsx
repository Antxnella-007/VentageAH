"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Lightbulb,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import type { AnalyzePayload } from "@/lib/analyze-payload";
import { compileInvoices, type CompiledReport } from "@/lib/compile";

const WAVE = 4;

function money(amount: number | null | undefined, currency = "USD") {
  if (amount == null || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency === "USDT" ? "USD" : currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function InvoiceStudio() {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"idle" | "text" | "ai" | "done">("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<AnalyzePayload | null>(null);
  const [history, setHistory] = useState<AnalyzePayload[]>([]);

  const compiled = useMemo(() => compileInvoices(history), [history]);
  const a = active?.analysis;

  const steps = useMemo(
    () => [
      { id: "text", label: "Plain text", hint: "PDF / image / Word → text on this server" },
      { id: "ai", label: "Gemini", hint: "Every invoice is read, then clipped" },
      { id: "done", label: "Advice", hint: "Ledger, flags, and compiled spend" },
    ],
    [],
  );

  useEffect(() => {
    void loadLedger();
    folderRef.current?.setAttribute("webkitdirectory", "");
    folderRef.current?.setAttribute("directory", "");
  }, []);

  async function loadLedger() {
    try {
      const res = await fetch("/api/ledger");
      const body = (await res.json()) as { results?: AnalyzePayload[] };
      if (body.results?.length) {
        setHistory(body.results);
        setActive((current) => current ?? body.results?.[0] ?? null);
        if (body.results.length) setStep("done");
      }
    } catch {
      // Empty ledger is fine on a fresh machine.
    }
  }

  async function run(files: File[]) {
    const readable = files.filter((file) => file.size > 0 && !file.name.startsWith("."));
    if (!readable.length) return;
    setError(null);
    setBusy(true);
    setStep("text");
    const merged: AnalyzePayload[] = [];
    try {
      for (let start = 0; start < readable.length; start += WAVE) {
        const wave = readable.slice(start, start + WAVE);
        setProgress(`Reading ${Math.min(start + wave.length, readable.length)} of ${readable.length}`);
        window.setTimeout(() => setStep("ai"), 400);
        const form = new FormData();
        for (const file of wave) {
          form.append("files", file);
          form.append("paths", file.webkitRelativePath || file.name);
        }
        const res = await fetch("/api/analyze", { method: "POST", body: form });
        const body = (await res.json()) as { error?: string; results?: AnalyzePayload[] };
        if (!res.ok) throw new Error(body.error ?? "Could not read that batch.");
        merged.push(...(body.results ?? []));
        setHistory((prev) => mergeHistory(merged, prev));
        const latest = merged[merged.length - 1];
        if (latest) setActive(latest);
      }
      if (!merged.length) throw new Error("No analysis came back.");
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something broke. Try a PDF or TXT.");
      if (!history.length) setStep("idle");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function sample() {
    const res = await fetch("/sample-invoice.txt");
    const blob = await res.blob();
    await run([new File([blob], "sample-cloudnet.txt", { type: "text/plain" })]);
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-8 text-white md:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.28em] text-[#ffc53d]">BILLSPARK</p>
          <p className="mt-1 text-sm text-white/70">Invoice sense for multi-company, multi-branch teams</p>
        </div>
        <div className="rounded-full bg-white/10 px-4 py-2 text-xs text-white/80">
          Every file is analyzed · Saved to the ledger · English
        </div>
      </header>

      <section className="animate-pop rounded-[2rem] bg-gradient-to-br from-[#ff4d6d] via-[#ff8a3d] to-[#ffc53d] p-[3px] shadow-[0_20px_80px_#ff4d6d44]">
        <div
          className={`rounded-[1.85rem] bg-[#0b1020] px-6 py-12 text-center md:px-16 ${drag ? "ring-4 ring-[#2ee6a6]" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDrag(false);
            const dropped = [
              ...Array.from(event.dataTransfer.files),
              ...itemsFromDrop(event.dataTransfer.items),
            ];
            void run(uniqueFiles(dropped));
          }}
        >
          <div className="relative mx-auto mb-5 flex size-20 items-center justify-center">
            <span className="pulse-ring absolute inset-0 rounded-full bg-[#2ee6a6]" />
            <span className="relative flex size-16 items-center justify-center rounded-full bg-[#2ee6a6] text-[#0b1020]">
              <Upload className="size-7" />
            </span>
          </div>
          <h1
            className="text-4xl font-semibold tracking-tight md:text-6xl"
            style={{ fontFamily: "var(--font-fraunces)" }}
          >
            Drop a bill.
            <br />
            Get the story.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/70">
            Drop one invoice or a whole company folder. Each file is extracted here, sent to Gemini as clipped text,
            saved, and rolled into the group totals — the way an AP desk works a stack.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-[#2ee6a6] px-6 py-3 text-sm font-semibold text-[#0b1020] hover:bg-[#7fffd0] disabled:opacity-60"
            >
              {busy ? progress || "Reading…" : "Choose invoice"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => folderRef.current?.click()}
              className="rounded-full bg-[#7c5cff] px-6 py-3 text-sm font-semibold text-white hover:bg-[#9a82ff] disabled:opacity-60"
            >
              Choose folder
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void sample()}
              className="rounded-full bg-[#7c5cff] px-6 py-3 text-sm font-semibold text-white hover:bg-[#9a82ff] disabled:opacity-60"
            >
              Try the sample
            </button>
          </div>
          <p className="mt-4 text-xs text-white/50">
            Folders like Company / Branch / July work best · PDF, PNG, JPG, DOCX, TXT, CSV · 10 MB each
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.docx,application/pdf,image/*,text/plain"
            onChange={(event) => {
              void run(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <input
            ref={folderRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              void run(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </div>
      </section>

      <ol className="mt-8 grid gap-3 md:grid-cols-3">
        {steps.map((item, index) => {
          const on =
            (item.id === "text" && (step === "text" || step === "ai" || step === "done")) ||
            (item.id === "ai" && (step === "ai" || step === "done")) ||
            (item.id === "done" && step === "done");
          return (
            <li
              key={item.id}
              className={`rounded-2xl border px-4 py-4 ${on ? "border-[#2ee6a6] bg-[#2ee6a61a]" : "border-white/10 bg-white/5"}`}
            >
              <p className="text-xs font-semibold text-[#ffc53d]">0{index + 1}</p>
              <p className="mt-1 font-semibold">{item.label}</p>
              <p className="text-sm text-white/60">{item.hint}</p>
            </li>
          );
        })}
      </ol>

      {error ? (
        <p className="mt-6 rounded-2xl bg-[#ff4d6d] px-4 py-3 text-sm font-medium text-white">{error}</p>
      ) : null}

      {compiled.invoiceCount > 0 ? <CompiledBoard report={compiled} /> : null}

      {a && active ? (
        <div className="animate-pop mt-10 space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
            <article className="rounded-[1.8rem] bg-white p-6 text-[#0b1020] shadow-2xl md:p-8">
              <p className="text-xs font-semibold tracking-[0.2em] text-[#ff4d6d]">SUMMARY</p>
              <h2 className="mt-2 text-3xl font-semibold" style={{ fontFamily: "var(--font-fraunces)" }}>
                {a.supplier}
              </h2>
              <p className="mt-3 text-lg leading-7 text-[#334155]">{a.summary || a.brief}</p>
              <p className="mt-3 text-sm text-[#64748b]">{a.brief}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Fact label="Invoice" value={a.invoiceNumber} />
                <Fact label="Total" value={`${money(a.total, a.currency)} ${a.currency}`} />
                <Fact label="Tax" value={money(a.taxAmount, a.currency)} />
                <Fact label="Due" value={a.dueDate ?? "—"} />
                <Fact label="Company" value={active.company || a.companyGuess || "Unassigned"} />
                <Fact label="Branch" value={active.branch || a.branchGuess || "Unassigned"} />
                <Fact label="Terms" value={a.paymentTerms ?? "—"} />
                <Fact label="Category" value={a.category ?? "—"} />
              </div>
              <p className="mt-5 text-xs text-[#64748b]">
                <Zap className="mr-1 inline size-3" />
                {active.extraction.sentLength} / {active.extraction.originalLength} chars sent · {active.extraction.method} ·{" "}
                {active.usedFallback ? "local draft" : active.model}
              </p>
            </article>

            <aside className="flex flex-col gap-4">
              <div className="rounded-[1.8rem] bg-[#7c5cff] p-6 text-white">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="size-4" /> Risk pulse
                </p>
                <p className="mt-2 text-5xl font-semibold">{active.riskScore}</p>
                <p className="text-sm text-white/80">/ 100 · lower is calmer</p>
              </div>
              <div className="rounded-[1.8rem] bg-[#2ee6a6] p-6 text-[#0b1020]">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4" /> Cash
                </p>
                <p className="mt-2 text-sm leading-6">{a.cashImpact || "Due date drives when cash leaves."}</p>
              </div>
            </aside>
          </div>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-xl font-semibold">
              <Lightbulb className="size-5 text-[#ffc53d]" />
              Advice from this invoice
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {(a.advice.length ? a.advice : a.controllerChecks).map((tip, index) => (
                <div
                  key={tip}
                  className="rounded-2xl bg-[#ffc53d] p-5 text-[#0b1020]"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide">Do this</p>
                  <p className="mt-2 text-sm font-medium leading-6">{tip}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="mb-3 flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 text-[#ff4d6d]" /> Flags
              </p>
              {a.risks.length === 0 ? (
                <p className="text-sm text-white/60">Nothing loud.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {a.risks.map((risk) => (
                    <li key={risk.code + risk.detail} className="rounded-xl bg-white/10 p-3">
                      <span className="mr-2 rounded-full bg-[#ff4d6d] px-2 py-0.5 text-[10px] uppercase">
                        {risk.severity}
                      </span>
                      {risk.detail}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="mb-3 flex items-center gap-2 font-semibold">
                <CheckCircle2 className="size-4 text-[#2ee6a6]" /> Ask AP / the vendor
              </p>
              <ul className="list-disc space-y-2 pl-5 text-sm text-white/80">
                {(a.questionsForAp.length ? a.questionsForAp : ["Confirm the total includes tax."]).map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          </section>

          {a.lineItems.length > 0 ? (
            <section className="rounded-2xl bg-white p-5 text-[#0b1020]">
              <p className="mb-3 font-semibold">Line items</p>
              <div className="space-y-2 text-sm">
                {a.lineItems.slice(0, 12).map((line) => (
                  <div key={line.description} className="flex justify-between gap-4 border-b border-black/10 pb-2">
                    <span>{line.description}</span>
                    <span className="text-[#64748b]">
                      {line.qty ?? "—"} · {money(line.amount, a.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {active.extraction.preview ? (
            <details className="rounded-2xl bg-white/5 p-4 text-sm text-white/70">
              <summary className="cursor-pointer font-semibold text-white">Plain text we sent (clipped)</summary>
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-xs">
                {active.extraction.preview}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {history.length > 0 ? (
        <section className="mt-12">
          <p className="mb-3 text-sm font-semibold text-white/70">Company ledger</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {history.slice(0, 40).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActive(item);
                  setStep("done");
                }}
                className="min-w-48 rounded-2xl bg-white/10 px-4 py-3 text-left hover:bg-white/20"
              >
                <p className="font-semibold">{item.analysis.supplier}</p>
                <p className="text-xs text-white/60">
                  {item.company} · {item.branch}
                </p>
                <p className="text-xs text-white/60">{item.analysis.invoiceNumber}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CompiledBoard({ report }: { report: CompiledReport }) {
  return (
    <section className="mt-10 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi tone="white" label="Invoices on file" value={String(report.invoiceCount)} />
        <Kpi tone="mint" label="Spend compiled" value={money(report.totalSpend, report.currency)} />
        <Kpi tone="violet" label="Flagged for AP" value={String(report.flaggedCount)} />
        <Kpi tone="sun" label="Average risk" value={String(report.avgRisk)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.8rem] bg-white p-6 text-[#0b1020]">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#ff4d6d]">COMPANIES</p>
          <div className="mt-4 space-y-3">
            {report.companies.map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-3 rounded-2xl bg-[#fff4e5] p-3">
                <div>
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-[#64748b]">
                    {row.count} invoices · {row.flagged} flagged
                  </p>
                </div>
                <p className="font-semibold">{money(row.spend, report.currency)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#ffc53d]">BRANCHES</p>
          <div className="mt-4 space-y-3">
            {report.branches.map((row) => (
              <div key={`${row.company}-${row.name}`} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-white/60">
                    {row.company} · {row.count} bills · risk {row.avgRisk}
                  </p>
                </div>
                <p className="text-sm font-semibold">{money(row.spend, report.currency)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-[#ffc53d] p-5 text-[#0b1020]">
          <p className="text-xs font-semibold uppercase tracking-wide">Desk notes from the stack</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm font-medium">
            {(report.advice.length ? report.advice : ["Keep posting matched invoices.", "Review flagged duplicates first."]).map(
              (tip) => (
                <li key={tip}>{tip}</li>
              ),
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="mb-3 font-semibold">Top suppliers</p>
          <div className="space-y-2 text-sm">
            {report.suppliers.map((row) => (
              <div key={row.name} className="flex justify-between gap-3">
                <span>
                  {row.name} <span className="text-white/50">×{row.count}</span>
                </span>
                <span>{money(row.spend, report.currency)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "white" | "mint" | "violet" | "sun";
}) {
  const cls =
    tone === "mint"
      ? "bg-[#2ee6a6] text-[#0b1020]"
      : tone === "violet"
        ? "bg-[#7c5cff] text-white"
        : tone === "sun"
          ? "bg-[#ffc53d] text-[#0b1020]"
          : "bg-white text-[#0b1020]";
  return (
    <div className={`rounded-[1.8rem] p-5 ${cls}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#fff4e5] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#b45309]">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function mergeHistory(incoming: AnalyzePayload[], prev: AnalyzePayload[]) {
  const map = new Map<string, AnalyzePayload>();
  for (const item of [...incoming, ...prev]) map.set(item.id, item);
  return [...map.values()];
}

function uniqueFiles(files: File[]) {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = `${file.webkitRelativePath || file.name}:${file.size}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function itemsFromDrop(items: DataTransferItemList | undefined) {
  if (!items) return [] as File[];
  return Array.from(items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}
