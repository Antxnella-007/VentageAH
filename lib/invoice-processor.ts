import { prisma } from "@/lib/db";
import { processInvoice } from "@/lib/qvac";
import { reconcileAndPersist } from "@/lib/reconciliation";
import { writeAuditLog } from "@/lib/audit";
import { detectBranchAnomalies } from "@/lib/anomaly";
import { explainAnomaly } from "@/lib/qvac";
import type { DemoRole } from "@/lib/roles";

const CONCURRENCY = 3;

export async function processInvoiceIds(
  ids: string[],
  actor: { name: string; role: DemoRole | string },
) {
  await writeAuditLog({
    eventType: "INVOICE_PROCESSING_STARTED",
    actor: actor.name,
    actorRole: actor.role,
    description: `QVAC processing started for ${ids.length} invoices`,
    entityType: "InvoiceBatch",
    metadata: { count: ids.length },
  });

  let cursor = 0;
  async function worker() {
    while (cursor < ids.length) {
      const index = cursor;
      cursor += 1;
      const id = ids[index];
      await processOne(id, index, actor);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => worker()));

  await writeAuditLog({
    eventType: "INVOICE_PROCESSED",
    actor: actor.name,
    actorRole: actor.role,
    description: `QVAC processing complete. ${ids.length} invoices processed locally`,
    entityType: "InvoiceBatch",
    metadata: { count: ids.length },
  });

  await refreshBranchSpend();
  await recordNewAnomalies(actor);
}

async function processOne(
  id: string,
  index: number,
  actor: { name: string; role: DemoRole | string },
) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return;

  await prisma.invoice.update({
    where: { id },
    data: { status: "PROCESSING" },
  });

  try {
    const filePath = invoice.sourceFile ?? `memory://${invoice.invoiceNumber}`;
    const result = await processInvoice(filePath, index, invoice.originalFilename ?? undefined);
    const branch = await prisma.branch.findFirst({ where: { name: result.fields.branch } });

    await prisma.invoice.update({
      where: { id },
      data: {
        invoiceNumber: result.fields.invoiceNumber,
        supplier: result.fields.supplier,
        branchId: branch?.id ?? invoice.branchId,
        date: new Date(`${result.fields.date}T12:00:00.000Z`),
        total: result.fields.total,
        currency: result.fields.currency,
        ocrText: result.ocrText,
        status: "PROCESSED",
      },
    });

    const outcome = await reconcileAndPersist(id);
    if (outcome?.status !== "MATCHED") {
      await writeAuditLog({
        eventType: "INVOICE_FLAGGED",
        actor: actor.name,
        actorRole: actor.role,
        description: `${result.fields.invoiceNumber} requires review (${outcome?.status ?? "FLAGGED"})`,
        entityType: "Invoice",
        entityId: id,
        metadata: { reason: outcome?.flagReason },
      });
    }
  } catch {
    await prisma.invoice.update({
      where: { id },
      data: {
        status: "ERROR",
        flagReason: "This invoice could not be processed. Other invoices in the batch were not interrupted.",
      },
    });
  }
}

export async function refreshBranchSpend() {
  const branches = await prisma.branch.findMany({ include: { invoices: true } });
  for (const branch of branches) {
    const currentSpend = branch.invoices
      .filter((invoice) => invoice.status === "PROCESSED" || invoice.status === "FLAGGED")
      .reduce((sum, invoice) => sum + invoice.total, 0);
    await prisma.branch.update({
      where: { id: branch.id },
      data: { currentSpend },
    });
  }
}

async function recordNewAnomalies(actor: { name: string; role: DemoRole | string }) {
  const branches = await prisma.branch.findMany();
  const anomalies = detectBranchAnomalies(
    branches.map((branch) => ({
      branch: branch.name,
      currentSpend: branch.currentSpend,
      historicalAverage: branch.historicalAverage,
    })),
  );

  for (const anomaly of anomalies) {
    const explanation = await explainAnomaly(anomaly);
    await writeAuditLog({
      eventType: "ANOMALY_DETECTED",
      actor: actor.name,
      actorRole: actor.role,
      description: `${anomaly.branch} spending is ${anomaly.deviationPercent.toFixed(1)}% above historical baseline`,
      entityType: "Branch",
      entityId: anomaly.branch,
      metadata: { ...anomaly, explanation },
    });
  }
}
