import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auditCategory } from "@/lib/audit-categories";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") ?? "All";

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const items = logs
    .map((log) => ({
      ...log,
      category: auditCategory(log.eventType),
      metadata: log.metadata ? (JSON.parse(log.metadata) as Record<string, unknown>) : null,
    }))
    .filter((log) => filter === "All" || log.category === filter);

  return NextResponse.json({ logs: items });
}
