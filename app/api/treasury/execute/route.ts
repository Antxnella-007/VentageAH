import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { executePayment } from "@/lib/wdk";
import { writeAuditLog } from "@/lib/audit";
import { actorFor, canExecutePayments, getCurrentRole } from "@/lib/roles";
import { batchIdSchema } from "@/lib/validators";

const bodySchema = z.object({
  batchId: batchIdSchema,
});

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid batch id is required." }, { status: 400 });
  }

  const role = await getCurrentRole();
  if (!canExecutePayments(role)) {
    return NextResponse.json(
      { error: "Only the CFO or Controller can execute treasury payments." },
      { status: 403 },
    );
  }
  const actor = actorFor(role);

  const batch = await prisma.paymentBatch.findUnique({
    where: { id: parsed.data.batchId },
    include: { payments: { orderBy: { createdAt: "asc" } } },
  });

  if (!batch) {
    return NextResponse.json({ error: "Payment batch was not found." }, { status: 404 });
  }
  if (batch.status !== "READY") {
    return NextResponse.json(
      { error: "This batch must reach 2 / 2 approvals before execution." },
      { status: 400 },
    );
  }

  await prisma.paymentBatch.update({
    where: { id: batch.id },
    data: { status: "EXECUTING" },
  });

  await writeAuditLog({
    eventType: "PAYMENT_EXECUTION_STARTED",
    actor: actor.name,
    actorRole: actor.role,
    description: `WDK payment execution started — ${batch.payments.length} supplier payments`,
    entityType: "PaymentBatch",
    entityId: batch.id,
  });

  let failed = 0;
  for (const payment of batch.payments) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PROCESSING" },
    });
    await delay(350);

    const result = await executePayment({
      to: payment.destinationAddress,
      amount: payment.amount,
    });

    if (!result.ok) {
      failed += 1;
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          errorMessage: "Settlement could not be completed for this supplier.",
        },
      });
      await writeAuditLog({
        eventType: "PAYMENT_FAILED",
        actor: actor.name,
        actorRole: actor.role,
        description: `Payment failed for ${payment.supplier}`,
        entityType: "Payment",
        entityId: payment.id,
      });
      continue;
    }

    const nextStatus = result.broadcast ? "CONFIRMED" : "PREVIEWED";
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        transactionHash: result.transactionHash,
      },
    });
    await writeAuditLog({
      eventType: result.broadcast ? "PAYMENT_CONFIRMED" : "PAYMENT_PREVIEWED",
      actor: actor.name,
      actorRole: actor.role,
      description: `${payment.supplier} ${result.mode === "dry-run" ? "dry run" : result.mode === "demo" ? "demo transaction" : "confirmed"} ${result.transactionHash ?? ""}`.trim(),
      entityType: "Payment",
      entityId: payment.id,
      metadata: {
        mode: result.mode,
        transactionHash: result.transactionHash,
        broadcast: result.broadcast,
      },
    });
  }

  const finalStatus = failed === 0 ? "COMPLETED" : failed === batch.payments.length ? "FAILED" : "PARTIAL_FAILURE";
  await prisma.paymentBatch.update({
    where: { id: batch.id },
    data: { status: finalStatus },
  });
  await writeAuditLog({
    eventType: "PAYMENT_BATCH_COMPLETED",
    actor: actor.name,
    actorRole: actor.role,
    description:
      finalStatus === "COMPLETED"
        ? `${batch.batchNumber} completed`
        : `${batch.batchNumber} finished with ${failed} failed payment(s)`,
    entityType: "PaymentBatch",
    entityId: batch.id,
    metadata: { status: finalStatus, failed },
  });

  return NextResponse.json({ ok: true, status: finalStatus, failed });
}
