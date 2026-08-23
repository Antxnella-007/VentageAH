import { prisma } from "@/lib/db";
import { detectBranchAnomalies } from "@/lib/anomaly";
import { environmentLabel, isDemoMode } from "@/lib/config";
import { checkGeminiHealth } from "@/lib/gemini";
import type { HealthResponse } from "@/types";
import { useMemoryLedger } from "@/lib/runtime";

export async function getHealth(): Promise<HealthResponse> {
  let database: HealthResponse["database"] = "online";
  if (useMemoryLedger()) {
    database = "online";
  } else {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "unavailable";
    }
  }

  const gemini = await checkGeminiHealth();

  return {
    app: "online",
    gemini,
    qvac: gemini === "online" ? "online" : gemini === "demo" ? "demo" : "unavailable",
    wdk: "dry-run",
    database,
    environment: isDemoMode() && gemini !== "online" ? "Demo" : "Live",
  };
}

export async function getDashboardPayload() {
  const [branches, invoices] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
    prisma.invoice.findMany({
      include: { branch: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const processed = invoices.filter(
    (invoice) => invoice.status === "PROCESSED" || invoice.status === "FLAGGED",
  );
  const totalSpend = processed.reduce((sum, invoice) => sum + invoice.total, 0);
  const flagged = invoices.filter((invoice) => invoice.status === "FLAGGED");

  const branchSpend = branches.map((branch) => ({
    branch: branch.name,
    currentSpend: processed
      .filter((invoice) => invoice.branchId === branch.id)
      .reduce((sum, invoice) => sum + invoice.total, 0),
    historicalAverage: branch.historicalAverage,
    deviationPercent:
      branch.historicalAverage === 0
        ? 0
        : ((branch.currentSpend - branch.historicalAverage) / branch.historicalAverage) * 100,
    anomalous: branch.currentSpend > branch.historicalAverage * 1.25,
  }));

  const detected = detectBranchAnomalies(
    branches.map((branch) => ({
      branch: branch.name,
      currentSpend: processed
        .filter((invoice) => invoice.branchId === branch.id)
        .reduce((sum, invoice) => sum + invoice.total, 0),
      historicalAverage: branch.historicalAverage,
    })),
  );

  const recentAnalyzed = invoices.filter((invoice) => invoice.brief).slice(0, 8);

  return {
    environment: environmentLabel(),
    demoMode: isDemoMode(),
    kpis: {
      totalSpend,
      totalSpendDelta: 8.4,
      pendingPayments: flagged.reduce((sum, invoice) => sum + invoice.total, 0),
      invoicesProcessed: processed.length,
      anomalies: detected.length + flagged.length,
      reconciliationRate: processed.length
        ? ((processed.length - flagged.length) / processed.length) * 100
        : 0,
      localAiProcessing: 100,
    },
    branchSpend,
    anomalies: detected.map((item) => ({
      ...item,
      explanation: `${item.branch} está ${item.deviationPercent.toFixed(1)}% sobre su promedio histórico.`,
    })),
    pendingBatch: null,
    recentInvoices: recentAnalyzed.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      supplier: invoice.supplier,
      branch: invoice.branch.name,
      amount: invoice.total,
      currency: invoice.currency,
      date: invoice.date,
      status: invoice.status,
      brief: invoice.brief,
    })),
    gemini: await checkGeminiHealth(),
  };
}
