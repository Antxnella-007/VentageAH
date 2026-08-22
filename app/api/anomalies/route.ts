import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { detectBranchAnomalies } from "@/lib/anomaly";
import { explainAnomaly } from "@/lib/qvac";

export async function GET() {
  const branches = await prisma.branch.findMany();
  const flagged = await prisma.invoice.findMany({
    where: { status: "FLAGGED" },
    include: { branch: true },
    take: 10,
  });
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

  return NextResponse.json({ anomalies, flaggedInvoices: flagged });
}
