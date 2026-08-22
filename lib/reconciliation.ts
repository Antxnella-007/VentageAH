import type { PurchaseOrder } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ReconciliationOutcome = {
  status: "MATCHED" | "REVIEW_REQUIRED" | "NO_PURCHASE_ORDER";
  purchaseOrderId?: string;
  flagReason?: string;
};

const AMOUNT_TOLERANCE = 0.01;

export function reconcileInvoice(
  invoice: { supplier: string; branchName: string; total: number },
  purchaseOrders: Array<Pick<PurchaseOrder, "id" | "supplier" | "expectedAmount"> & { branchName: string }>,
): ReconciliationOutcome {
  const sameSupplier = purchaseOrders.filter(
    (po) => normalize(po.supplier) === normalize(invoice.supplier),
  );

  if (sameSupplier.length === 0) {
    return {
      status: "NO_PURCHASE_ORDER",
      flagReason: "No purchase order found for this supplier.",
    };
  }

  const sameBranch = sameSupplier.filter(
    (po) => normalize(po.branchName) === normalize(invoice.branchName),
  );

  if (sameBranch.length === 0) {
    return {
      status: "REVIEW_REQUIRED",
      purchaseOrderId: sameSupplier[0]?.id,
      flagReason: "Supplier matches a purchase order, but the branch does not.",
    };
  }

  const amountMatch = sameBranch.find(
    (po) => Math.abs(po.expectedAmount - invoice.total) <= AMOUNT_TOLERANCE,
  );

  if (amountMatch) {
    return { status: "MATCHED", purchaseOrderId: amountMatch.id };
  }

  const closest = sameBranch[0];
  return {
    status: "REVIEW_REQUIRED",
    purchaseOrderId: closest?.id,
    flagReason: `Invoice total differs from expected purchase order amount (${closest?.expectedAmount ?? 0}).`,
  };
}

export async function reconcileAndPersist(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { branch: true },
  });
  if (!invoice) return;

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    include: { branch: true },
  });

  const outcome = reconcileInvoice(
    {
      supplier: invoice.supplier,
      branchName: invoice.branch.name,
      total: invoice.total,
    },
    purchaseOrders.map((po) => ({
      id: po.id,
      supplier: po.supplier,
      expectedAmount: po.expectedAmount,
      branchName: po.branch.name,
    })),
  );

  const flagged = outcome.status !== "MATCHED";

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      reconciliationStatus: outcome.status,
      purchaseOrderId: outcome.purchaseOrderId,
      flagReason: outcome.flagReason,
      status: flagged ? "FLAGGED" : "PROCESSED",
    },
  });

  if (outcome.purchaseOrderId && outcome.status === "MATCHED") {
    await prisma.purchaseOrder.update({
      where: { id: outcome.purchaseOrderId },
      data: { status: "MATCHED" },
    });
  }

  return outcome;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
