import { PrismaClient } from "@prisma/client";
import {
  BRANCH_TARGETS,
  DEMO_INVOICE_TEMPLATES,
  SUPPLIERS,
  TREASURY_PAYMENTS,
} from "../demo-data/catalog";

const prisma = new PrismaClient();

function mulberry32(seed: number) {
  return function rng() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.paymentBatch.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.branch.deleteMany();

  const branches = [];
  for (const item of BRANCH_TARGETS) {
    branches.push(
      await prisma.branch.create({
        data: {
          name: item.name,
          historicalAverage: item.historicalAverage,
          currentSpend: item.currentSpend,
        },
      }),
    );
  }

  const branchByName = Object.fromEntries(branches.map((branch) => [branch.name, branch]));

  const purchaseOrders = [];
  for (const template of DEMO_INVOICE_TEMPLATES) {
    const expected =
      template.invoiceNumber === "CN-3021" ? 6200 : template.total;
    purchaseOrders.push(
      await prisma.purchaseOrder.create({
        data: {
          purchaseOrderNumber: `PO-${template.invoiceNumber}`,
          supplier: template.supplier,
          branchId: branchByName[template.branch].id,
          expectedAmount: expected,
          status: template.invoiceNumber === "CN-3021" ? "OPEN" : "MATCHED",
        },
      }),
    );
  }

  const extraSuppliers = [...SUPPLIERS];
  for (let i = 0; i < extraSuppliers.length; i += 1) {
    const branch = branches[i % branches.length];
    await prisma.purchaseOrder.create({
      data: {
        purchaseOrderNumber: `PO-RET-${String(i + 1).padStart(3, "0")}`,
        supplier: extraSuppliers[i],
        branchId: branch.id,
        expectedAmount: 1500 + i * 85,
        status: "OPEN",
      },
    });
  }

  const invoicesPlan: {
    invoiceNumber: string;
    supplier: string;
    branchName: string;
    date: Date;
    total: number;
    status: "PROCESSED" | "FLAGGED";
    reconciliationStatus: "MATCHED" | "REVIEW_REQUIRED" | "NO_PURCHASE_ORDER";
    flagReason?: string;
    ocrText: string;
  }[] = [];

  const flaggedCloudNet = DEMO_INVOICE_TEMPLATES[0];
  invoicesPlan.push({
    invoiceNumber: flaggedCloudNet.invoiceNumber,
    supplier: flaggedCloudNet.supplier,
    branchName: flaggedCloudNet.branch,
    date: new Date("2026-08-14T12:00:00.000Z"),
    total: flaggedCloudNet.total,
    status: "FLAGGED",
    reconciliationStatus: "REVIEW_REQUIRED",
    flagReason: "Invoice total differs from expected purchase order amount (6200).",
    ocrText: `INVOICE ${flaggedCloudNet.invoiceNumber}\nSupplier: ${flaggedCloudNet.supplier}\nBill to branch: ${flaggedCloudNet.branch}\nTotal due: ${flaggedCloudNet.total}.00 USD`,
  });

  invoicesPlan.push({
    invoiceNumber: "QN-1294",
    supplier: "Quantum Networks",
    branchName: "Cartago",
    date: new Date("2026-08-22T12:00:00.000Z"),
    total: 3120,
    status: "FLAGGED",
    reconciliationStatus: "NO_PURCHASE_ORDER",
    flagReason: "No purchase order found for this supplier at the Cartago branch for this amount.",
    ocrText: "INVOICE QN-1294\nSupplier: Quantum Networks\nBill to branch: Cartago\nTotal due: 3120.00 USD",
  });

  invoicesPlan.push({
    invoiceNumber: "MC-2401",
    supplier: "MetroCloud",
    branchName: "Cartago",
    date: new Date("2026-08-19T12:00:00.000Z"),
    total: 2680,
    status: "FLAGGED",
    reconciliationStatus: "REVIEW_REQUIRED",
    flagReason: "Supplier matches a purchase order, but the branch allocation is unusual versus history.",
    ocrText: "INVOICE MC-2401\nSupplier: MetroCloud\nBill to branch: Cartago\nTotal due: 2680.00 USD",
  });

  const remainingByBranch: Record<string, number> = {};
  for (const item of BRANCH_TARGETS) {
    const already = invoicesPlan
      .filter((invoice) => invoice.branchName === item.name)
      .reduce((sum, invoice) => sum + invoice.total, 0);
    remainingByBranch[item.name] = item.currentSpend - already;
  }

  const rng = mulberry32(202608);

  const counts: Record<string, number> = {
    "San José": 32,
    Heredia: 31,
    Alajuela: 32,
    Cartago: 33,
  };

  let serial = 1000;
  for (const branch of BRANCH_TARGETS) {
    const existing = invoicesPlan.filter((invoice) => invoice.branchName === branch.name);
    const need = counts[branch.name] - existing.length;
    const amounts: number[] = [];
    let remaining = remainingByBranch[branch.name];
    for (let i = 0; i < need; i += 1) {
      if (i === need - 1) {
        amounts.push(Math.round(remaining * 100) / 100);
        break;
      }
      const avg = remaining / (need - i);
      const jitter = 0.55 + rng() * 0.9;
      let value = Math.max(180, Math.round(avg * jitter));
      if (value > remaining - 180 * (need - i - 1)) {
        value = Math.max(180, remaining - 180 * (need - i - 1));
      }
      amounts.push(value);
      remaining -= value;
    }

    for (let i = 0; i < need; i += 1) {
      const supplier = SUPPLIERS[(serial + i) % SUPPLIERS.length];
      const day = 1 + Math.floor(rng() * 22);
      const invoiceNumber = `VH-${serial}`;
      serial += 1;
      invoicesPlan.push({
        invoiceNumber,
        supplier,
        branchName: branch.name,
        date: new Date(`2026-08-${String(day).padStart(2, "0")}T12:00:00.000Z`),
        total: amounts[i],
        status: "PROCESSED",
        reconciliationStatus: "MATCHED",
        ocrText: `INVOICE ${invoiceNumber}\nSupplier: ${supplier}\nBill to branch: ${branch.name}\nTotal due: ${amounts[i].toFixed(2)} USD\nProcessed locally with QVAC.`,
      });
    }
  }

  for (const invoice of invoicesPlan) {
    const po = purchaseOrders.find(
      (item) =>
        item.supplier === invoice.supplier &&
        Math.abs(item.expectedAmount - invoice.total) < 0.5,
    );
    await prisma.invoice.create({
      data: {
        invoiceNumber: invoice.invoiceNumber,
        supplier: invoice.supplier,
        branchId: branchByName[invoice.branchName].id,
        date: invoice.date,
        total: invoice.total,
        currency: "USD",
        status: invoice.status,
        ocrText: invoice.ocrText,
        reconciliationStatus: invoice.reconciliationStatus,
        purchaseOrderId: invoice.reconciliationStatus === "MATCHED" ? po?.id : invoice.invoiceNumber === "CN-3021" ? purchaseOrders.find((item) => item.purchaseOrderNumber === "PO-CN-3021")?.id : undefined,
        flagReason: invoice.flagReason,
        sourceFile: null,
      },
    });
  }

  const batch = await prisma.paymentBatch.create({
    data: {
      batchNumber: "PAY-2026-08-001",
      name: "August Supplier Payments",
      totalAmount: 42670,
      currency: "USDT",
      status: "PENDING_APPROVAL",
      payments: {
        create: TREASURY_PAYMENTS.map((payment) => ({
          supplier: payment.supplier,
          destinationAddress: payment.destinationAddress,
          amount: payment.amount,
          currency: "USDT",
          status: "PENDING",
        })),
      },
    },
  });

  await prisma.approval.create({
    data: {
      batchId: batch.id,
      approverName: "Maria Rodriguez",
      role: "CFO",
      approvedAt: new Date("2026-08-22T14:41:00.000Z"),
    },
  });

  const auditEvents: {
    eventType: string;
    actor: string;
    actorRole: string;
    description: string;
    entityType: string;
    entityId?: string;
    createdAt: Date;
    metadata?: Record<string, unknown>;
  }[] = [
    {
      eventType: "INVOICE_BATCH_UPLOADED",
      actor: "Elena Castro",
      actorRole: "Finance Analyst",
      description: "30 documents uploaded by Finance Operations",
      entityType: "InvoiceBatch",
      createdAt: new Date("2026-08-22T14:31:00.000Z"),
    },
    {
      eventType: "INVOICE_PROCESSING_STARTED",
      actor: "Elena Castro",
      actorRole: "Finance Analyst",
      description: "QVAC processing started for 30 invoices",
      entityType: "InvoiceBatch",
      createdAt: new Date("2026-08-22T14:31:20.000Z"),
    },
    {
      eventType: "INVOICE_PROCESSED",
      actor: "Elena Castro",
      actorRole: "Finance Analyst",
      description: "30 invoices processed locally",
      entityType: "InvoiceBatch",
      createdAt: new Date("2026-08-22T14:32:00.000Z"),
    },
    {
      eventType: "ANOMALY_DETECTED",
      actor: "Vantage Analytics",
      actorRole: "System",
      description: "Cartago spending is 31.2% above historical baseline",
      entityType: "Branch",
      entityId: "Cartago",
      createdAt: new Date("2026-08-22T14:34:00.000Z"),
      metadata: { severity: "high", deviationPercent: 31.2 },
    },
    {
      eventType: "INVOICE_FLAGGED",
      actor: "Vantage Analytics",
      actorRole: "System",
      description: "CN-3021 requires review (REVIEW_REQUIRED)",
      entityType: "Invoice",
      createdAt: new Date("2026-08-22T14:34:30.000Z"),
    },
    {
      eventType: "PAYMENT_BATCH_CREATED",
      actor: "Elena Castro",
      actorRole: "Finance Analyst",
      description: "August Supplier Payments created — 14 suppliers, 42,670 USDT",
      entityType: "PaymentBatch",
      entityId: batch.id,
      createdAt: new Date("2026-08-22T14:38:00.000Z"),
    },
    {
      eventType: "PAYMENT_BATCH_APPROVED",
      actor: "Maria Rodriguez",
      actorRole: "CFO",
      description: "Maria Rodriguez approved PAY-2026-08-001",
      entityType: "PaymentBatch",
      entityId: batch.id,
      createdAt: new Date("2026-08-22T14:41:00.000Z"),
    },
  ];

  for (const event of auditEvents) {
    await prisma.auditLog.create({
      data: {
        eventType: event.eventType,
        actor: event.actor,
        actorRole: event.actorRole,
        description: event.description,
        entityType: event.entityType,
        entityId: event.entityId,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        createdAt: event.createdAt,
      },
    });
  }

  const created = await prisma.invoice.count();
  const totals = await prisma.invoice.groupBy({
    by: ["branchId"],
    _sum: { total: true },
    _count: true,
  });
  console.log(`Seeded ${created} invoices`);
  console.log(totals);
  console.log(`Batch ${batch.batchNumber} with ${TREASURY_PAYMENTS.length} payments`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
