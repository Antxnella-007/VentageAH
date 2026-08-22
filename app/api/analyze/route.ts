import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storeUpload } from "@/lib/uploads";
import { extractPlainText } from "@/lib/extract-text";
import { analyzeInvoiceText } from "@/lib/gemini";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { actorFor, getCurrentRole } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit";
import { MAX_BATCH_FILES, validateUploadFile } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    return await handleAnalyze(request);
  } catch (error) {
    console.error("Analyze failed", error instanceof Error ? error.message : "error");
    return NextResponse.json(
      { error: "No se pudo guardar el análisis. Recarga e inténtalo de nuevo." },
      { status: 500 },
    );
  }
}

async function handleAnalyze(request: Request) {
  const locale = await getCurrentLocale();
  const actor = actorFor(await getCurrentRole());
  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "Sube al menos un archivo." }, { status: 400 });
  }
  if (files.length > MAX_BATCH_FILES) {
    return NextResponse.json({ error: "Máximo 30 archivos." }, { status: 400 });
  }

  const branches = await prisma.branch.findMany();
  const defaultBranch = branches.find((branch) => branch.name === "San José") ?? branches[0];
  if (!defaultBranch) {
    return NextResponse.json({ error: "No hay sucursales inicializadas." }, { status: 500 });
  }

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
      locale,
      knownBranches: branches.map((branch) => branch.name),
      knownSuppliers,
    });

    const branch =
      branches.find(
        (item) => analysis.branchGuess && item.name.toLowerCase() === analysis.branchGuess.toLowerCase(),
      ) ?? defaultBranch;

    const duplicate = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: analysis.invoiceNumber,
        supplier: analysis.supplier,
      },
    });

    if (duplicate && analysis.invoiceNumber !== "—") {
      analysis.risks = [
        {
          code: "DUPLICATE",
          detail: `Ya existe ${analysis.invoiceNumber} de ${analysis.supplier} en el registro.`,
          severity: "high",
        },
        ...analysis.risks,
      ];
    }

    const riskScore = Math.min(
      100,
      analysis.risks.reduce((sum, risk) => sum + (risk.severity === "high" ? 40 : risk.severity === "medium" ? 20 : 8), 0),
    );

    const total = analysis.total && analysis.total > 0 ? analysis.total : 0.01;
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: analysis.invoiceNumber || `UPL-${Date.now()}`,
        supplier: analysis.supplier || "Proveedor",
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
        brief: analysis.brief,
        riskScore,
        dueDate: analysis.dueDate,
        taxAmount: analysis.taxAmount ?? undefined,
        extractionMethod: extraction.method,
        charsSent: extraction.sentLength,
        flagReason: analysis.risks[0]?.detail,
      },
      include: { branch: true },
    });

    await writeAuditLog({
      eventType: "INVOICE_PROCESSED",
      actor: actor.name,
      actorRole: actor.role,
      description: `Analizó ${invoice.invoiceNumber} (${extraction.method}, ${extraction.sentLength} chars → ${model})`,
      entityType: "Invoice",
      entityId: invoice.id,
    });

    results.push({
      id: invoice.id,
      extraction: {
        method: extraction.method,
        originalLength: extraction.originalLength,
        sentLength: extraction.sentLength,
        preview: extraction.text.slice(0, 500),
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
        date: invoice.date,
        status: invoice.status,
        originalFilename: invoice.originalFilename,
        brief: invoice.brief,
      },
    });
  }

  return NextResponse.json({ count: results.length, results });
}
