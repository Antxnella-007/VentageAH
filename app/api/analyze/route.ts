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
    console.error("Analyze failed", "batch error");
    return NextResponse.json({ error: "Could not finish this batch. Try PDF or TXT files." }, { status: 500 });
  }
}

async function handleAnalyze(request: Request) {
  await ensureDb();
  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  const paths = form.getAll("paths").map((item) => String(item));

  if (files.length === 0) {
    return NextResponse.json({ error: "Drop at least one invoice." }, { status: 400 });
  }
  if (files.length > MAX_BATCH_FILES) {
    return NextResponse.json({ error: "Up to 80 files per request. The page sends them in smaller waves." }, { status: 400 });
  }

  const incoming = files
    .map((file, index) => {
      const relative = paths[index] || file.webkitRelativePath || file.name;
      return { file, relative };
    })
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
    return NextResponse.json({ error: skipped[0] ?? "No readable invoices in that drop." }, { status: 400 });
  }

  const names = await knownOrgNames();
  const knownSuppliers = [
    ...new Set((await prisma.invoice.findMany({ select: { supplier: true }, take: 120 })).map((row) => row.supplier)),
  ];

  const drafts = await mapPool(valid, 2, async ({ file, relative }): Promise<Draft> => {
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
  });

  const seen = new Map<string, number>();
  const results: AnalyzePayload[] = [];

  for (const draft of drafts) {
    const { company, branch } = await resolveCompanyAndBranch({
      companyHint: draft.companyHint,
      branchHint: draft.branchHint,
      analysisCompany: draft.analysis.companyGuess,
      analysisBranch: draft.analysis.branchGuess,
    });

    draft.analysis.companyGuess = company.name;
    draft.analysis.branchGuess = branch.name;

    const key = `${company.id}::${draft.analysis.invoiceNumber}::${draft.analysis.supplier}`.toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);

    const duplicate = await prisma.invoice.findFirst({
      where: {
        companyId: company.id,
        invoiceNumber: draft.analysis.invoiceNumber,
        supplier: draft.analysis.supplier,
      },
    });

    if ((duplicate || (seen.get(key) ?? 0) > 1) && draft.analysis.invoiceNumber !== "—") {
      draft.analysis.risks = [
        {
          code: "DUPLICATE",
          detail: `${draft.analysis.invoiceNumber} from ${draft.analysis.supplier} is already in the ${company.name} register.`,
          severity: "high",
        },
        ...draft.analysis.risks,
      ];
    }

    const riskScore = scoreRisk(draft.analysis);
    const total = draft.analysis.total && draft.analysis.total > 0 ? draft.analysis.total : 0.01;
    const flagged = riskScore >= 40 || draft.analysis.risks.some((risk) => risk.severity === "high");

    try {
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
          riskScore,
          dueDate: draft.analysis.dueDate,
          taxAmount: draft.analysis.taxAmount ?? undefined,
          extractionMethod: draft.extraction.method,
          charsSent: draft.extraction.sentLength,
          flagReason: draft.analysis.risks[0]?.detail,
        },
      });

      results.push({
        id: invoice.id,
        extraction: draft.extraction,
        model: draft.model,
        usedFallback: draft.usedFallback,
        riskScore,
        analysis: draft.analysis,
        company: company.name,
        branch: branch.name,
        originalFilename: draft.fileName,
        folderPath: draft.folderPath,
        status: invoice.status,
      });
    } catch (error) {
      results.push({
        id: `tmp-${draft.storedName}`,
        extraction: draft.extraction,
        model: draft.model,
        usedFallback: draft.usedFallback,
        riskScore,
        analysis: draft.analysis,
        company: company.name,
        branch: branch.name,
        originalFilename: draft.fileName,
        folderPath: draft.folderPath,
        status: "PROCESSED",
      });
      console.error("Persist skipped", error instanceof Error ? error.message : "error");
    }
  }

  try {
    await refreshBranchSpend();
  } catch {
    // Spend totals are best-effort on ephemeral hosts.
  }

  return NextResponse.json({
    count: results.length,
    skipped,
    results,
    compiled: compileInvoices(results),
  });
}
