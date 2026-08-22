import { prisma } from "@/lib/db";
import { detectBranchAnomalies } from "@/lib/anomaly";
import { explainAnomaly } from "@/lib/qvac";
import { checkQvacHealth } from "@/lib/qvac";
import { checkWdkHealth, getTreasuryAddress, getTreasuryBalance } from "@/lib/wdk";
import { environmentLabel, isDemoMode } from "@/lib/config";
import type { HealthResponse } from "@/types";

export async function getHealth(): Promise<HealthResponse> {
  let database: HealthResponse["database"] = "online";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "unavailable";
  }

  const qvac = await checkQvacHealth();
  const wdk = await checkWdkHealth();

  return {
    app: "online",
    qvac: qvac.status,
    wdk: wdk.status,
    database,
    environment: environmentLabel(),
  };
}

export async function getDashboardPayload() {
  const [branches, invoices, batches, audit] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
    prisma.invoice.findMany({
      include: { branch: true },
      orderBy: { date: "desc" },
    }),
    prisma.paymentBatch.findMany({
      include: { approvals: true, payments: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const processed = invoices.filter(
    (invoice) => invoice.status === "PROCESSED" || invoice.status === "FLAGGED",
  );
  const totalSpend = processed.reduce((sum, invoice) => sum + invoice.total, 0);
  const pendingBatch = batches.find(
    (batch) =>
      batch.status === "PENDING_APPROVAL" ||
      batch.status === "READY" ||
      batch.status === "DRAFT",
  );
  const flagged = invoices.filter((invoice) => invoice.status === "FLAGGED");
  const matched = invoices.filter((invoice) => invoice.reconciliationStatus === "MATCHED").length;
  const reconRate = invoices.length === 0 ? 0 : (matched / invoices.length) * 100;

  const branchSpend = branches.map((branch) => ({
    branch: branch.name,
    currentSpend: branch.currentSpend,
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
      currentSpend: branch.currentSpend,
      historicalAverage: branch.historicalAverage,
    })),
  );

  const anomalies = await Promise.all(
    detected.map(async (item) => ({
      ...item,
      explanation: await explainAnomaly(item),
    })),
  );

  const anomalyCount = anomalies.length + flagged.length;

  return {
    environment: environmentLabel(),
    demoMode: isDemoMode(),
    kpis: {
      totalSpend,
      totalSpendDelta: 8.4,
      pendingPayments: pendingBatch?.totalAmount ?? 0,
      invoicesProcessed: processed.length,
      anomalies: anomalyCount,
      reconciliationRate: reconRate,
      localAiProcessing: 100,
    },
    branchSpend,
    anomalies,
    pendingBatch: pendingBatch
      ? {
          id: pendingBatch.id,
          batchNumber: pendingBatch.batchNumber,
          name: pendingBatch.name,
          suppliers: pendingBatch.payments.length,
          totalAmount: pendingBatch.totalAmount,
          currency: pendingBatch.currency,
          status: pendingBatch.status,
          approvals: pendingBatch.approvals.map((item) => ({
            role: item.role,
            approverName: item.approverName,
            approvedAt: item.approvedAt,
          })),
          required: 2,
        }
      : null,
    recentInvoices: invoices.slice(0, 8).map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      supplier: invoice.supplier,
      branch: invoice.branch.name,
      amount: invoice.total,
      currency: invoice.currency,
      date: invoice.date,
      status: invoice.status,
    })),
    recentActivity: audit,
    treasury: {
      address: await getTreasuryAddress(),
      balance: await getTreasuryBalance(),
      wdk: await checkWdkHealth(),
      qvac: await checkQvacHealth(),
    },
  };
}
