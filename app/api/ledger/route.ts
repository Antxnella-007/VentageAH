import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { compileInvoices } from "@/lib/compile";
import { analysisFromRow } from "@/lib/analyze-payload";
import { ensureDb } from "@/lib/ensure-db";
import { refreshBranchSpend } from "@/lib/invoice-processor";
import { useMemoryLedger } from "@/lib/runtime";
import { memoryLedgerPayload, memoryReset } from "@/lib/memory-ledger";
import { jsonError, publicErrorMessage } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  if (useMemoryLedger()) {
    return NextResponse.json({
      ...memoryLedgerPayload(),
      warning: "Demo ledger is in memory. Vercel SQLite is not persistent.",
    });
  }

  try {
    await ensureDb();
    const [companies, invoices] = await Promise.all([
      prisma.company.findMany({
        include: { branches: { orderBy: { name: "asc" } } },
        orderBy: { name: "asc" },
      }),
      prisma.invoice.findMany({
        include: { company: true, branch: true },
        orderBy: { createdAt: "desc" },
        take: 400,
      }),
    ]);

    const results = invoices.map(analysisFromRow);
    return NextResponse.json({
      source: "database",
      companies: companies.map((company) => ({
        id: company.id,
        name: company.name,
        branches: company.branches.map((branch) => ({
          id: branch.id,
          name: branch.name,
          currentSpend: branch.currentSpend,
        })),
      })),
      results,
      compiled: compileInvoices(results),
    });
  } catch (error) {
    console.error("Ledger read failed", publicErrorMessage(error));
    if (process.env.DEMO_MODE === "true") {
      return NextResponse.json({
        ...memoryLedgerPayload(),
        warning: "Database is unavailable. Showing the demo ledger.",
      });
    }
    return jsonError("Database is unavailable.", 500);
  }
}

export async function DELETE() {
  if (useMemoryLedger()) {
    memoryReset();
    return NextResponse.json({ ok: true, source: "demo", results: [], compiled: compileInvoices([]) });
  }

  try {
    await ensureDb();
    await prisma.invoice.deleteMany();
    await refreshBranchSpend();
    return NextResponse.json({ ok: true, source: "database", results: [], compiled: compileInvoices([]) });
  } catch (error) {
    console.error("Ledger reset failed", publicErrorMessage(error));
    return jsonError("Could not clear the ledger.", 500);
  }
}
