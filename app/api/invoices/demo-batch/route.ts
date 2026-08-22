import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEMO_INVOICE_TEMPLATES } from "@/demo-data/catalog";
import { writeAuditLog } from "@/lib/audit";
import { actorFor, getCurrentRole } from "@/lib/roles";
export async function POST() {
  const actor = actorFor(await getCurrentRole());
  const defaultBranch = await prisma.branch.findFirst({ where: { name: "San José" } });
  if (!defaultBranch) {
    return NextResponse.json({ error: "Company branches are not initialized." }, { status: 500 });
  }

  const created = [];
  for (const [index, template] of DEMO_INVOICE_TEMPLATES.entries()) {
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `TMP-DEMO-${index + 1}`,
        supplier: "Pending extraction",
        companyId: defaultBranch.companyId,
        branchId: defaultBranch.id,
        date: new Date(),
        total: 0.01,
        currency: "USD",
        status: "UPLOADED",
        sourceFile: `demo/${template.invoiceNumber}.png`,
        originalFilename: `${template.invoiceNumber}.png`,
      },
    });
    created.push(invoice);
  }

  await writeAuditLog({
    eventType: "INVOICE_BATCH_UPLOADED",
    actor: actor.name,
    actorRole: actor.role,
    description: `${created.length} documents uploaded by Finance Operations`,
    entityType: "InvoiceBatch",
    metadata: { count: created.length, source: "demo-batch" },
  });

  return NextResponse.json({
    ok: true,
    count: created.length,
    ids: created.map((item) => item.id),
  });
}
