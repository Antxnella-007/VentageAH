import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storeUpload } from "@/lib/uploads";
import { extractPlainText } from "@/lib/extract-text";
import { analyzeInvoiceText, type InvoiceAnalysis } from "@/lib/gemini";
import { MAX_BATCH_FILES, validateUploadFile } from "@/lib/validators";
import { isJunkFile, parseRelativePath } from "@/lib/folder-path";
import { knownOrgNames, resolveCompanyAndBranch } from "@/lib/org";
import { compileInvoices } from "@/lib/compile";
import { mapPool } from "@/lib/map-pool";
import { refreshBranchSpend } from "@/lib/invoice-processor";
import { scoreRisk, type AnalyzePayload } from "@/lib/analyze-payload";
import { ensureDb } from "@/lib/ensure-db";
import { useMemoryLedger } from "@/lib/runtime";
import {
  memoryFindDuplicate,
  memorySaveInvoice,
  memoryState,
} from "@/lib/memory-ledger";
import { jsonError, publicErrorMessage } from "@/lib/http";

export const maxDuration = 60;
export const runtime = "nodejs";

type Draft = {
  fileName: string;
  folderPath: string;
  companyHint: string | null;
  branchHint: string | null;
  extraction: AnalyzePayload["extraction"];
  model: string;
  usedFallback: boolean;
  analysis: InvoiceAnalysis;
  storedName: string;
};

export async function POST(request: Request) {
  try {
    return await handleAnalyze(request);
  } catch (error) {
    console.error("Analyze failed", publicErrorMessage(error));
    return jsonError("Could not finish this batch. Try a PNG, JPG, or TXT file.", 500);
  }
}

async function handleAnalyze(request: Request) {
  if (!useMemoryLedger()) {
    try {
      await ensureDb();
    } catch (error) {
      console.error("Database unavailable during analyze", publicErrorMessage(error));
      return jsonError("Database is unavailable.", 500);
    }
  }

  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  const paths = form.getAll("paths").map((item) => String(item));

  if (files.length === 0) {
    return jsonError("Drop at least one invoice.", 400);
  }
  if (files.length > MAX_BATCH_FILES) {
    return jsonError("Up to 80 files per request. The page sends them in smaller waves.", 400);
  }

  const incoming = files
    .map((file, index) => ({
      file,
      relative: paths[index] || file.webkitRelativePath || file.name,
    }))
    .filter((item) => !isJunkFile(item.file.name));

  const valid: typeof incoming = [];
  const skipped: string[] = [];
  for (const item of incoming) {
    const check = validateUploadFile({ name: item.file.name, type: item.file.type, size: item.file.size });
    if (!check.ok) {
      skipped.push(`${item.file.name}: ${check.error}`);
      continue;
    }
    valid.push(item);
  }

  if (valid.length === 0) {
    return jsonError(skipped[0] ?? "No readable invoices in that drop.", 400);
  }

  const names = await knownOrgNames();
  let knownSuppliers: string[] = [];
  if (useMemoryLedger()) {
    knownSuppliers = [...new Set(memoryState().invoices.map((row) => row.analysis.supplier))];
  } else {
    try {
      knownSuppliers = [
        ...new Set((await prisma.invoice.findMany({ select: { supplier: true }, take: 120 })).map((row) => row.supplier)),
      ];
    } catch (error) {
      console.error("Could not load suppliers", publicErrorMessage(error));
    }
  }

  const drafts = await mapPool(valid, 2, async ({ file, relative }): Promise<Draft | null> => {
    try {
      const parsed = parseRelativePath(relative);
      const stored = await storeUpload(file);
      const extraction = await extractPlainText({
        buffer: stored.buffer,
        filename: stored.originalFilename,
        mime: file.type,
      });
      const { analysis, model, usedFallback } = await analyzeInvoiceText({
        text: extraction.text,
        filename: stored.originalFilename,
        folderPath: parsed.folderPath,
        knownCompanies: names.companies,
        knownBranches: names.branches,
        knownSuppliers,
      });
      if ((file.type.includes("pdf") || stored.originalFilename.toLowerCase().endsWith(".pdf")) && !extraction.text.trim()) {
        analysis.risks = [
          {
            code: "PDF_TEXT",
            detail: "Could not read text from this PDF. PNG or JPG invoices still work.",
            severity: "medium",
          },
          ...analysis.risks,
        ];
      }
      return {
        fileName: stored.originalFilename,
        folderPath: parsed.folderPath,
        companyHint: parsed.companyHint,
        branchHint: parsed.branchHint,
        extraction: {
          method: extraction.method,
          originalLength: extraction.originalLength,
          sentLength: extraction.sentLength,
          preview: extraction.text.slice(0, 600),
        },
        model,
        usedFallback,
        analysis,
        storedName: stored.storedName,
      };
    } catch (error) {
      skipped.push(`${file.name}: ${publicErrorMessage(error)}`);
      return null;
    }
  });

  const usable = drafts.filter((draft): draft is Draft => Boolean(draft));
  const results: AnalyzePayload[] = [];

  for (const draft of usable) {
    const { company, branch } = await resolveCompanyAndBranch({
      companyHint: draft.companyHint,
      branchHint: draft.branchHint,
      analysisCompany: draft.analysis.companyGuess,
      analysisBranch: draft.analysis.branchGuess,
    });

    draft.analysis.companyGuess = company.name;
    draft.analysis.branchGuess = branch.name;

    const flagged =
      scoreRisk(draft.analysis) >= 40 || draft.analysis.risks.some((risk) => risk.severity === "high");
    const total = draft.analysis.total && draft.analysis.total > 0 ? draft.analysis.total : 0.01;
    const payload: AnalyzePayload = {
      id: `mem-${draft.storedName}`,
      extraction: draft.extraction,
      model: draft.model,
      usedFallback: draft.usedFallback,
      riskScore: scoreRisk(draft.analysis),
      analysis: draft.analysis,
      company: company.name,
      branch: branch.name,
      originalFilename: draft.fileName,
      folderPath: draft.folderPath,
      status: flagged ? "FLAGGED" : "PROCESSED",
    };

    if (useMemoryLedger()) {
      const duplicate = memoryFindDuplicate(company.name, draft.analysis.invoiceNumber, draft.analysis.supplier);
      if (duplicate && draft.analysis.invoiceNumber !== "—") {
        draft.analysis.risks = [
          {
            code: "DUPLICATE",
            detail: `${draft.analysis.invoiceNumber} from ${draft.analysis.supplier} is already in the ${company.name} register.`,
            severity: "high",
          },
          ...draft.analysis.risks,
        ];
        payload.analysis = draft.analysis;
        payload.riskScore = scoreRisk(draft.analysis);
        payload.status = "FLAGGED";
      }
      payload.id = `mem-${Date.now().toString(36)}-${results.length}`;
      memorySaveInvoice(payload);
      results.push(payload);
      continue;
    }

    try {
      const duplicate = await prisma.invoice.findFirst({
        where: {
          companyId: company.id,
          invoiceNumber: draft.analysis.invoiceNumber,
          supplier: draft.analysis.supplier,
        },
      });
      if (duplicate && draft.analysis.invoiceNumber !== "—") {
        draft.analysis.risks = [
          {
            code: "DUPLICATE",
            detail: `${draft.analysis.invoiceNumber} from ${draft.analysis.supplier} is already in the ${company.name} register.`,
            severity: "high",
          },
          ...draft.analysis.risks,
        ];
      }
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: draft.analysis.invoiceNumber || `UPL-${Date.now()}`,
          supplier: draft.analysis.supplier || "Supplier",
          companyId: company.id,
          branchId: branch.id,
          date: draft.analysis.date ? new Date(`${draft.analysis.date}T12:00:00.000Z`) : new Date(),
          total,
          currency: draft.analysis.currency || "USD",
          status: flagged ? "FLAGGED" : "PROCESSED",
          sourceFile: draft.storedName,
          originalFilename: draft.fileName,
          folderPath: draft.folderPath || null,
          ocrText: draft.extraction.preview,
          extractedText: draft.extraction.preview,
          analysisJson: JSON.stringify(draft.analysis),
          brief: draft.analysis.summary || draft.analysis.brief,
          riskScore: scoreRisk(draft.analysis),
          dueDate: draft.analysis.dueDate,
          taxAmount: draft.analysis.taxAmount ?? undefined,
          extractionMethod: draft.extraction.method,
          charsSent: draft.extraction.sentLength,
          flagReason: draft.analysis.risks[0]?.detail,
        },
      });
      results.push({
        ...payload,
        id: invoice.id,
        status: invoice.status,
        analysis: draft.analysis,
        riskScore: scoreRisk(draft.analysis),
      });
    } catch (error) {
      console.error("Persist skipped", publicErrorMessage(error));
      memorySaveInvoice(payload);
      results.push(payload);
    }
  }

  if (!useMemoryLedger()) {
    try {
      await refreshBranchSpend();
    } catch (error) {
      console.error("Spend refresh skipped", publicErrorMessage(error));
    }
  }

  if (results.length === 0) {
    return jsonError(skipped[0] ?? "Could not read those invoices.", 500);
  }

  return NextResponse.json({
    source: useMemoryLedger() ? "demo" : "database",
    count: results.length,
    skipped,
    results,
    compiled: compileInvoices(results),
  });
}
