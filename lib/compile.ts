import type { InvoiceAnalysis } from "@/lib/invoice-schema";

export type AnalyzedInvoice = {
  id: string;
  riskScore: number;
  analysis: InvoiceAnalysis;
  company: string;
  branch: string;
  originalFilename?: string | null;
  folderPath?: string | null;
};

export type CompiledReport = {
  invoiceCount: number;
  flaggedCount: number;
  totalSpend: number;
  totalTax: number;
  avgRisk: number;
  currency: string;
  companies: { name: string; count: number; spend: number; flagged: number }[];
  branches: { name: string; company: string; count: number; spend: number; flagged: number; avgRisk: number }[];
  suppliers: { name: string; count: number; spend: number }[];
  flags: { detail: string; severity: string; count: number }[];
  advice: string[];
  dueSoon: { invoiceNumber: string; supplier: string; dueDate: string; total: number; branch: string }[];
};

function bump<T extends { count: number }>(map: Map<string, T>, key: string, create: () => T, update: (row: T) => void) {
  const current = map.get(key) ?? create();
  update(current);
  map.set(key, current);
}

export function compileInvoices(items: AnalyzedInvoice[]): CompiledReport {
  const companies = new Map<string, { name: string; count: number; spend: number; flagged: number }>();
  const branches = new Map<
    string,
    { name: string; company: string; count: number; spend: number; flagged: number; riskSum: number; avgRisk: number }
  >();
  const suppliers = new Map<string, { name: string; count: number; spend: number }>();
  const flags = new Map<string, { detail: string; severity: string; count: number }>();
  const adviceCount = new Map<string, number>();
  const dueSoon: CompiledReport["dueSoon"] = [];

  let totalSpend = 0;
  let totalTax = 0;
  let riskSum = 0;
  let flaggedCount = 0;
  let currency = "USD";

  for (const item of items) {
    const analysis = item.analysis;
    const spend = analysis.total && analysis.total > 0 ? analysis.total : 0;
    const tax = analysis.taxAmount && analysis.taxAmount > 0 ? analysis.taxAmount : 0;
    const flagged = item.riskScore >= 40 || analysis.risks.some((risk) => risk.severity === "high");
    const company = item.company || analysis.companyGuess || "Unassigned company";
    const branch = item.branch || analysis.branchGuess || "Unassigned branch";

    totalSpend += spend;
    totalTax += tax;
    riskSum += item.riskScore;
    if (flagged) flaggedCount += 1;
    if (analysis.currency) currency = analysis.currency;

    bump(
      companies,
      company,
      () => ({ name: company, count: 0, spend: 0, flagged: 0 }),
      (row) => {
        row.count += 1;
        row.spend += spend;
        if (flagged) row.flagged += 1;
      },
    );

    bump(
      branches,
      `${company}::${branch}`,
      () => ({ name: branch, company, count: 0, spend: 0, flagged: 0, riskSum: 0, avgRisk: 0 }),
      (row) => {
        row.count += 1;
        row.spend += spend;
        row.riskSum += item.riskScore;
        if (flagged) row.flagged += 1;
        row.avgRisk = Math.round(row.riskSum / row.count);
      },
    );

    bump(
      suppliers,
      analysis.supplier || "Unknown supplier",
      () => ({ name: analysis.supplier || "Unknown supplier", count: 0, spend: 0 }),
      (row) => {
        row.count += 1;
        row.spend += spend;
      },
    );

    for (const risk of analysis.risks) {
      const key = `${risk.severity}:${risk.detail}`;
      bump(
        flags,
        key,
        () => ({ detail: risk.detail, severity: risk.severity, count: 0 }),
        (row) => {
          row.count += 1;
        },
      );
    }

    for (const tip of analysis.advice.slice(0, 4)) {
      adviceCount.set(tip, (adviceCount.get(tip) ?? 0) + 1);
    }

    if (analysis.dueDate) {
      dueSoon.push({
        invoiceNumber: analysis.invoiceNumber,
        supplier: analysis.supplier,
        dueDate: analysis.dueDate,
        total: spend,
        branch,
      });
    }
  }

  return {
    invoiceCount: items.length,
    flaggedCount,
    totalSpend,
    totalTax,
    avgRisk: items.length ? Math.round(riskSum / items.length) : 0,
    currency,
    companies: [...companies.values()].sort((a, b) => b.spend - a.spend),
    branches: [...branches.values()]
      .map(({ riskSum: _riskSum, ...row }) => row)
      .sort((a, b) => b.spend - a.spend),
    suppliers: [...suppliers.values()].sort((a, b) => b.spend - a.spend).slice(0, 12),
    flags: [...flags.values()].sort((a, b) => b.count - a.count).slice(0, 12),
    advice: [...adviceCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tip]) => tip),
    dueSoon: dueSoon.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 12),
  };
}
