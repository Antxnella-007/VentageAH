"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Lightbulb, Upload } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<AnalyzePayload | null>(null);
  const [history, setHistory] = useState<AnalyzePayload[]>([]);
  const [progress, setProgress] = useState("");

  const compiled = useMemo(() => compileInvoices(history), [history]);
  const a = active?.analysis;

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
    const merged: AnalyzePayload[] = [];
    try {
      for (let start = 0; start < readable.length; start += WAVE) {
        const wave = readable.slice(start, start + WAVE);
        setProgress(`Reading ${Math.min(start + wave.length, readable.length)} of ${readable.length}`);
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
      if (!merged.length) throw new Error("No invoices were saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read those invoices. Try a PDF or spreadsheet.");
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
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-8 text-[#4d0011] md:px-8">
      <header className="mb-10">
        <p
          className="text-4xl font-semibold tracking-tight text-[#4d0011] md:text-5xl"
          style={{ fontFamily: "var(--font-fraunces)" }}
        >
          Vantage
        </p>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[#902124]">
          Invoice control for companies with many branches. Upload a bill or a whole folder, capture every field, and
          see compiled spend, flags, and next steps for AP — the work of a finance desk, in one place.
        </p>
      </header>

      <section className="animate-pop rounded-[2rem] border border-[#c2858c]/50 bg-white p-[3px] shadow-[0_18px_50px_#4d001114]">
        <div
          className={`rounded-[1.85rem] bg-[#f7f1f2] px-6 py-12 text-center md:px-16 ${drag ? "ring-4 ring-[#8eb9ff]" : ""}`}
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
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-[#4d0011] text-white">
            <Upload className="size-7" />
          </div>
          <h1
            className="text-3xl font-semibold tracking-tight md:text-5xl"
            style={{ fontFamily: "var(--font-fraunces)" }}
          >
            Drop invoices.
            <br />
            Post with confidence.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-[#902124]/80">
            Each file is read on the server, saved to the company ledger, and rolled into group totals by company and
            branch.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-[#4d0011] px-6 py-3 text-sm font-semibold text-white hover:bg-[#902124] disabled:opacity-60"
            >
              {busy ? progress || "Reading…" : "Choose invoice"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => folderRef.current?.click()}
              className="rounded-full bg-[#8eb9ff] px-6 py-3 text-sm font-semibold text-[#4d0011] hover:bg-[#a9cbff] disabled:opacity-60"
            >
              Choose folder
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void sample()}
              className="rounded-full bg-[#c2858c] px-6 py-3 text-sm font-semibold text-white hover:bg-[#d09aa0] disabled:opacity-60"
            >
              Try the sample
            </button>
          </div>
          <p className="mt-4 text-xs text-[#902124]/60">PDF, Word, or spreadsheet · folders as Company / Branch · 10 MB each</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.txt,.csv,.docx,application/pdf,text/plain"
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

      {error ? (
        <p className="mt-6 rounded-2xl bg-[#902124] px-4 py-3 text-sm font-medium text-white">{error}</p>
      ) : null}

      {compiled.invoiceCount > 0 ? <CompiledBoard report={compiled} /> : null}

      {a && active ? (
        <div className="animate-pop mt-10 space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
            <article className="rounded-[1.8rem] border border-[#c2858c]/40 bg-white p-6 shadow-sm md:p-8">
              <p className="text-xs font-semibold tracking-[0.2em] text-[#902124]">SUMMARY</p>
              <h2 className="mt-2 text-3xl font-semibold" style={{ fontFamily: "var(--font-fraunces)" }}>
                {a.supplier}
              </h2>
              <p className="mt-3 text-lg leading-7 text-[#4d0011]/80">{a.summary || a.brief}</p>
              <p className="mt-3 text-sm text-[#902124]/70">{a.brief}</p>
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
            </article>

            <aside className="flex flex-col gap-4">
              <div className="rounded-[1.8rem] bg-[#902124] p-6 text-white">
                <p className="text-sm font-semibold">Risk</p>
                <p className="mt-2 text-5xl font-semibold">{active.riskScore}</p>
                <p className="text-sm text-white/80">/ 100 · lower is calmer</p>
              </div>
              <div className="rounded-[1.8rem] bg-[#8eb9ff] p-6 text-[#4d0011]">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4" /> Cash
                </p>
                <p className="mt-2 text-sm leading-6">{a.cashImpact || "Due date drives when cash leaves."}</p>
              </div>
            </aside>
          </div>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-xl font-semibold">
              <Lightbulb className="size-5 text-[#902124]" />
              Next steps
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {(a.advice.length ? a.advice : a.controllerChecks).map((tip) => (
                <div key={tip} className="rounded-2xl bg-[#c2858c] p-5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-wide">Do this</p>
                  <p className="mt-2 text-sm font-medium leading-6">{tip}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#c2858c]/40 bg-white p-5">
              <p className="mb-3 flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 text-[#902124]" /> Flags
              </p>
              {a.risks.length === 0 ? (
                <p className="text-sm text-[#902124]/60">Nothing loud.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {a.risks.map((risk) => (
                    <li key={risk.code + risk.detail} className="rounded-xl bg-[#f7f1f2] p-3">
                      <span className="mr-2 rounded-full bg-[#902124] px-2 py-0.5 text-[10px] uppercase text-white">
                        {risk.severity}
                      </span>
                      {risk.detail}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-[#8eb9ff] bg-white p-5">
              <p className="mb-3 flex items-center gap-2 font-semibold">
                <CheckCircle2 className="size-4 text-[#8eb9ff]" /> Ask AP / the vendor
              </p>
              <ul className="list-disc space-y-2 pl-5 text-sm text-[#4d0011]/80">
                {(a.questionsForAp.length ? a.questionsForAp : ["Confirm the total includes tax."]).map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          </section>

          {a.lineItems.length > 0 ? (
            <section className="rounded-2xl border border-[#c2858c]/40 bg-white p-5">
              <p className="mb-3 font-semibold">Line items</p>
              <div className="space-y-2 text-sm">
                {a.lineItems.slice(0, 12).map((line) => (
                  <div key={line.description} className="flex justify-between gap-4 border-b border-[#c2858c]/30 pb-2">
                    <span>{line.description}</span>
                    <span className="text-[#902124]/70">
                      {line.qty ?? "—"} · {money(line.amount, a.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {history.length > 0 ? (
        <section className="mt-12">
          <p className="mb-3 text-sm font-semibold text-[#902124]">Company ledger</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {history.slice(0, 40).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item)}
                className="min-w-48 rounded-2xl border border-[#c2858c]/40 bg-white px-4 py-3 text-left hover:border-[#8eb9ff]"
              >
                <p className="font-semibold">{item.analysis.supplier}</p>
                <p className="text-xs text-[#902124]/70">
                  {item.company} · {item.branch}
                </p>
                <p className="text-xs text-[#902124]/70">{item.analysis.invoiceNumber}</p>
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
        <Kpi tone="mist" label="Invoices on file" value={String(report.invoiceCount)} />
        <Kpi tone="blue" label="Spend compiled" value={money(report.totalSpend, report.currency)} />
        <Kpi tone="red" label="Flagged for AP" value={String(report.flaggedCount)} />
        <Kpi tone="blush" label="Average risk" value={String(report.avgRisk)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.8rem] border border-[#c2858c]/40 bg-white p-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#902124]">COMPANIES</p>
          <div className="mt-4 space-y-3">
            {report.companies.map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-3 rounded-2xl bg-[#f7f1f2] p-3">
                <div>
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-[#902124]/70">
                    {row.count} invoices · {row.flagged} flagged
                  </p>
                </div>
                <p className="font-semibold">{money(row.spend, report.currency)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[1.8rem] border border-[#8eb9ff] bg-white p-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#4d0011]">BRANCHES</p>
          <div className="mt-4 space-y-3">
            {report.branches.map((row) => (
              <div key={`${row.company}-${row.name}`} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-[#902124]/70">
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
        <div className="rounded-2xl bg-[#4d0011] p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide">Desk notes from the stack</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm font-medium">
            {(report.advice.length ? report.advice : ["Keep posting matched invoices.", "Review flagged duplicates first."]).map(
              (tip) => (
                <li key={tip}>{tip}</li>
              ),
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-[#c2858c]/40 bg-white p-5">
          <p className="mb-3 font-semibold">Top suppliers</p>
          <div className="space-y-2 text-sm">
            {report.suppliers.map((row) => (
              <div key={row.name} className="flex justify-between gap-3">
                <span>
                  {row.name} <span className="text-[#902124]/50">×{row.count}</span>
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
  tone: "mist" | "blue" | "red" | "blush";
}) {
  const cls =
    tone === "blue"
      ? "bg-[#8eb9ff] text-[#4d0011]"
      : tone === "red"
        ? "bg-[#902124] text-white"
        : tone === "blush"
          ? "bg-[#c2858c] text-white"
          : "bg-[#f7f1f2] text-[#4d0011]";
  return (
    <div className={`rounded-[1.8rem] p-5 ${cls}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f7f1f2] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#902124]">{label}</p>
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
