import { invoiceAnalysisSchema, type InvoiceAnalysis } from "@/lib/invoice-schema";

export type AnalyzePayload = {
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
  company: string;
  branch: string;
  originalFilename: string;
  folderPath: string;
  status: string;
};

export function scoreRisk(analysis: InvoiceAnalysis) {
  return Math.min(
    100,
    analysis.risks.reduce(
      (sum, risk) => sum + (risk.severity === "high" ? 40 : risk.severity === "medium" ? 20 : 8),
      0,
    ),
  );
}

export function analysisFromRow(row: {
  id: string;
  invoiceNumber: string;
  supplier: string;
  total: number;
  currency: string;
  riskScore: number | null;
  status: string;
  brief: string | null;
  dueDate: string | null;
  taxAmount: number | null;
  analysisJson: string | null;
  originalFilename: string | null;
  folderPath: string | null;
  extractionMethod: string | null;
  charsSent: number | null;
  extractedText: string | null;
  company: { name: string };
  branch: { name: string };
}): AnalyzePayload {
  let analysis: InvoiceAnalysis;
  try {
    analysis = invoiceAnalysisSchema.parse(JSON.parse(row.analysisJson ?? "{}"));
  } catch {
    analysis = invoiceAnalysisSchema.parse({
      invoiceNumber: row.invoiceNumber,
      supplier: row.supplier,
      companyGuess: row.company.name,
      branchGuess: row.branch.name,
      total: row.total,
      currency: row.currency,
      taxAmount: row.taxAmount,
      dueDate: row.dueDate,
      summary: row.brief ?? "Stored invoice from the company ledger.",
      brief: row.brief ?? "Open this row to review supplier, total, and flags.",
      advice: ["Match to a purchase order.", "Confirm the branch allocation.", "Post if the total is expected."],
      risks: row.status === "FLAGGED" ? [{ code: "FLAGGED", detail: "Needs AP review.", severity: "high" }] : [],
      questionsForAp: [],
      controllerChecks: [],
    });
  }

  return {
    id: row.id,
    extraction: {
      method: row.extractionMethod ?? "stored",
      originalLength: row.charsSent ?? 0,
      sentLength: row.charsSent ?? 0,
      preview: row.extractedText ?? "",
    },
    model: "ledger",
    usedFallback: false,
    riskScore: row.riskScore ?? scoreRisk(analysis),
    analysis,
    company: row.company.name,
    branch: row.branch.name,
    originalFilename: row.originalFilename ?? row.invoiceNumber,
    folderPath: row.folderPath ?? "",
    status: row.status,
  };
}
