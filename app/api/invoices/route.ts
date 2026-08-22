import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const invoices = await prisma.invoice.findMany({
    include: { branch: true, purchaseOrder: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      supplier: invoice.supplier,
      branch: invoice.branch.name,
      date: invoice.date,
      total: invoice.total,
      currency: invoice.currency,
      status: invoice.status,
      sourceFile: invoice.sourceFile,
      originalFilename: invoice.originalFilename,
      reconciliationStatus: invoice.reconciliationStatus,
      flagReason: invoice.flagReason,
      createdAt: invoice.createdAt,
    })),
  });
}
