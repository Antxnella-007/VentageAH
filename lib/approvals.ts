import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { approvalRoleSchema } from "@/lib/validators";
import type { DemoRole } from "@/lib/roles";
import { ROLE_ACTORS, canApprove } from "@/lib/roles";

const REQUIRED_ROLES = ["CFO", "Controller"] as const;

export function approvalProgress(count: number): string {
  return `${count} / ${REQUIRED_ROLES.length}`;
}

export async function approveBatch(input: {
  batchId: string;
  role: DemoRole;
}) {
  if (!canApprove(input.role)) {
    throw new Error("This role is not authorized to approve treasury batches.");
  }

  const role = approvalRoleSchema.parse(input.role);
  const actor = ROLE_ACTORS[role].name;

  const batch = await prisma.paymentBatch.findUnique({
    where: { id: input.batchId },
    include: { approvals: true, payments: true },
  });

  if (!batch) {
    throw new Error("Payment batch was not found.");
  }

  if (batch.status !== "PENDING_APPROVAL" && batch.status !== "DRAFT") {
    throw new Error("This batch is no longer awaiting approval.");
  }

  const already = batch.approvals.find((item) => item.role === role);
  if (already) {
    throw new Error(`${role} has already approved this batch.`);
  }

  await prisma.approval.create({
    data: {
      batchId: batch.id,
      approverName: actor,
      role,
    },
  });

  await writeAuditLog({
    eventType: "PAYMENT_BATCH_APPROVED",
    actor,
    actorRole: role,
    description: `${actor} approved ${batch.batchNumber}`,
    entityType: "PaymentBatch",
    entityId: batch.id,
    metadata: { role },
  });

  const approvals = await prisma.approval.findMany({ where: { batchId: batch.id } });
  const hasAll = REQUIRED_ROLES.every((required) =>
    approvals.some((item) => item.role === required),
  );

  if (hasAll) {
    await prisma.paymentBatch.update({
      where: { id: batch.id },
      data: { status: "READY" },
    });
    await writeAuditLog({
      eventType: "APPROVAL_THRESHOLD_REACHED",
      actor,
      actorRole: role,
      description: `2 / 2 approvals obtained for ${batch.batchNumber}`,
      entityType: "PaymentBatch",
      entityId: batch.id,
    });
  } else if (batch.status === "DRAFT") {
    await prisma.paymentBatch.update({
      where: { id: batch.id },
      data: { status: "PENDING_APPROVAL" },
    });
  }

  return prisma.paymentBatch.findUniqueOrThrow({
    where: { id: batch.id },
    include: { approvals: true, payments: true },
  });
}
