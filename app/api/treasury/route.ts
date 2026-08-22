import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkWdkHealth, getTreasuryAddress, getTreasuryBalance } from "@/lib/wdk";

export async function GET() {
  const [batches, address, balance, wdk] = await Promise.all([
    prisma.paymentBatch.findMany({
      include: { approvals: true, payments: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    getTreasuryAddress(),
    getTreasuryBalance(),
    checkWdkHealth(),
  ]);

  const completed = batches.filter((batch) => batch.status === "COMPLETED");
  const pending = batches.filter(
    (batch) => batch.status === "PENDING_APPROVAL" || batch.status === "READY" || batch.status === "DRAFT",
  );

  return NextResponse.json({
    balance,
    address,
    wdk,
    pendingCount: pending.length,
    scheduledCount: batches.filter((batch) => batch.status === "READY").length,
    completedCount: completed.length,
    batches: batches.map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      name: batch.name,
      totalAmount: batch.totalAmount,
      currency: batch.currency,
      status: batch.status,
      suppliers: batch.payments.length,
      approvals: batch.approvals,
      payments: batch.payments,
    })),
  });
}
