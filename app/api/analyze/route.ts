import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storeUpload } from "@/lib/uploads";
import { extractPlainText } from "@/lib/extract-text";
import { analyzeInvoiceText } from "@/lib/gemini";
import { MAX_BATCH_FILES, validateUploadFile } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    return await handleAnalyze(request);
  } catch (error) {
    console.error("Analyze failed", error instanceof Error ? error.message : "error");
    return NextResponse.json({ error: "Could not finish this invoice. Try PDF or TXT." }, { status: 500 });
  }
}

async function handleAnalyze(request: Request) {
  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "Drop at least one invoice." }, { status: 400 });
  }
  if (files.length > MAX_BATCH_FILES) {
    return NextResponse.json({ error: "Up to 30 files at a time." }, { status: 400 });
  }

  let branches = await prisma.branch.findMany();
  if (branches.length === 0) {
    const created = await prisma.branch.create({
      data: { name: "Headquarters", historicalAverage: 40000, currentSpend: 0 },
    });
    branches = [created];
  }
  const defaultBranch = branches.find((branch) => branch.name === "San José") ?? branches[0];

  const knownSuppliers = [
    ...new Set((await prisma.invoice.findMany({ select: { supplier: true }, take: 80 })).map((row) => row.supplier)),
  ];

  const results = [];
  for (const file of files) {
    const check = validateUploadFile({ name: file.name, type: file.type, size: file.size });
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const stored = await storeUpload(file);
    const extraction = await extractPlainText({
      buffer: stored.buffer,
      filename: stored.originalFilename,
      mime: file.type,
    });

    const { analysis, model, usedFallback } = await analyzeInvoiceText({
      text: extraction.text,
      filename: stored.originalFilename,
      knownBranches: branches.map((branch) => branch.name),
      knownSuppliers,
    });

    const branch =
      branches.find(
        (item) => analysis.branchGuess && item.name.toLowerCase() === analysis.branchGuess.toLowerCase(),
      ) ?? defaultBranch;

    const duplicate = await prisma.invoice.findFirst({
      where: { invoiceNumber: analysis.invoiceNumber, supplier: analysis.supplier },
    });

    if (duplicate && analysis.invoiceNumber !== "—") {
      analysis.risks = [
        {
          code: "DUPLICATE",
          detail: `${analysis.invoiceNumber} from ${analysis.supplier} is already in the register.`,
          severity: "high",
        },
        ...analysis.risks,
      ];
    }

    const riskScore = Math.min(
      100,
      analysis.risks.reduce(
        (sum, risk) => sum + (risk.severity === "high" ? 40 : risk.severity === "medium" ? 20 : 8),
        0,
      ),
    );

    const total = analysis.total && analysis.total > 0 ? analysis.total : 0.01;
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: analysis.invoiceNumber || `UPL-${Date.now()}`,
        supplier: analysis.supplier || "Supplier",
        branchId: branch.id,
        date: analysis.date ? new Date(`${analysis.date}T12:00:00.000Z`) : new Date(),
        total,
        currency: analysis.currency || "USD",
        status: analysis.risks.some((risk) => risk.severity === "high") ? "FLAGGED" : "PROCESSED",
        sourceFile: stored.storedName,
        originalFilename: stored.originalFilename,
        ocrText: extraction.text,
        extractedText: extraction.text,
        analysisJson: JSON.stringify(analysis),
        brief: analysis.summary || analysis.brief,
        riskScore,
        dueDate: analysis.dueDate,
        taxAmount: analysis.taxAmount ?? undefined,
        extractionMethod: extraction.method,
        charsSent: extraction.sentLength,
        flagReason: analysis.risks[0]?.detail,
      },
      include: { branch: true },
    });

    results.push({
      id: invoice.id,
      extraction: {
        method: extraction.method,
        originalLength: extraction.originalLength,
        sentLength: extraction.sentLength,
        preview: extraction.text.slice(0, 600),
      },
      model,
      usedFallback,
      riskScore,
      analysis,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        supplier: invoice.supplier,
        branch: invoice.branch.name,
        total: invoice.total,
        currency: invoice.currency,
        originalFilename: invoice.originalFilename,
      },
    });
  }

  return NextResponse.json({ count: results.length, results });
}
