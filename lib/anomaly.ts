export type BranchSpendInput = {
  branch: string;
  currentSpend: number;
  historicalAverage: number;
};

export type AnomalyResult = {
  branch: string;
  currentSpend: number;
  historicalAverage: number;
  deviationPercent: number;
  severity: "medium" | "high" | "critical";
};

export function deviationPercent(currentSpend: number, historicalAverage: number): number {
  if (historicalAverage <= 0) return 0;
  return ((currentSpend - historicalAverage) / historicalAverage) * 100;
}

export function isAnomalous(currentSpend: number, historicalAverage: number): boolean {
  return currentSpend > historicalAverage * 1.25;
}

export function severityFor(deviation: number): AnomalyResult["severity"] {
  if (deviation > 50) return "critical";
  if (deviation > 35) return "high";
  return "medium";
}

export function detectBranchAnomalies(inputs: BranchSpendInput[]): AnomalyResult[] {
  return inputs
    .filter((item) => isAnomalous(item.currentSpend, item.historicalAverage))
    .map((item) => {
      const deviation = deviationPercent(item.currentSpend, item.historicalAverage);
      return {
        branch: item.branch,
        currentSpend: item.currentSpend,
        historicalAverage: item.historicalAverage,
        deviationPercent: deviation,
        severity: severityFor(deviation),
      };
    })
    .sort((a, b) => b.deviationPercent - a.deviationPercent);
}
