import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storeUpload } from "@/lib/uploads";
import { writeAuditLog } from "@/lib/audit";
import { actorFor, getCurrentRole } from "@/lib/roles";
import { MAX_BATCH_FILES, validateUploadFile } from "@/lib/validators";

export async function POST(request: Request) {
  const role = await getCurrentRole();
  const actor = actorFor(role);
  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "Drop at least one invoice to continue." }, { status: 400 });
  }
  if (files.length > MAX_BATCH_FILES) {
    return NextResponse.json({ error: "A batch can include up to 30 invoices." }, { status: 400 });
  }

  const defaultBranch = await prisma.branch.findFirst({ where: { name: "San José" } });
  if (!defaultBranch) {
    return NextResponse.json({ error: "Company branches are not initialized." }, { status: 500 });
  }

  const created = [];
  for (const file of files) {
    const check = validateUploadFile({ name: file.name, type: file.type, size: file.size });
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
    const stored = await storeUpload(file);
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `TMP-${stored.storedName.slice(0, 8)}`,
        supplier: "Pending extraction",
        companyId: defaultBranch.companyId,
        branchId: defaultBranch.id,
        date: new Date(),
        total: 0.01,
        currency: "USD",
        status: "UPLOADED",
        sourceFile: stored.storedName,
        originalFilename: stored.originalFilename,
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
    metadata: { count: created.length },
  });

  return NextResponse.json({ ids: created.map((item) => item.id), count: created.length });
}
