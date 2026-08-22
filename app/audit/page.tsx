import { AuditWorkspace } from "@/components/audit/audit-workspace";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <AuditWorkspace
      initialLogs={logs.map((log) => ({
        id: log.id,
        eventType: log.eventType,
        actor: log.actor,
        actorRole: log.actorRole,
        description: log.description,
        entityType: log.entityType,
        createdAt: log.createdAt.toISOString(),
      }))}
    />
  );
}
