import { prisma } from "@/lib/db";
import type { DemoRole } from "@/lib/roles";

export const AUDIT_EVENTS = [
  "INVOICE_BATCH_UPLOADED",
  "INVOICE_PROCESSING_STARTED",
  "INVOICE_PROCESSED",
  "INVOICE_FLAGGED",
  "ANOMALY_DETECTED",
  "PAYMENT_BATCH_CREATED",
  "PAYMENT_BATCH_APPROVED",
  "APPROVAL_THRESHOLD_REACHED",
  "PAYMENT_EXECUTION_STARTED",
  "PAYMENT_PREVIEWED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_FAILED",
  "PAYMENT_BATCH_COMPLETED",
] as const;

export type AuditEventType = (typeof AUDIT_EVENTS)[number];

export async function writeAuditLog(entry: {
  eventType: AuditEventType | string;
  actor: string;
  actorRole: DemoRole | string;
  description: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}) {
  return prisma.auditLog.create({
    data: {
      eventType: entry.eventType,
      actor: entry.actor,
      actorRole: entry.actorRole,
      description: entry.description,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      createdAt: entry.createdAt,
    },
  });
}
