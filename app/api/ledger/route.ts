import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { compileInvoices } from "@/lib/compile";
import { analysisFromRow } from "@/lib/analyze-payload";
import { ensureDb } from "@/lib/ensure-db";
import { refreshBranchSpend } from "@/lib/invoice-processor";

export const runtime = "nodejs";

export async function GET() {
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
    return NextResponse.json({ companies: [], results: [], compiled: compileInvoices([]) });
  }
}

export async function DELETE() {
  try {
    await ensureDb();
    await prisma.invoice.deleteMany();
    await refreshBranchSpend();
    return NextResponse.json({ ok: true, results: [], compiled: compileInvoices([]) });
  } catch {
    return NextResponse.json({ error: "Could not clear the ledger." }, { status: 500 });
  }
}
