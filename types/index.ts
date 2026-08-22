import type { DemoRole } from "@/lib/roles-shared";

export type ServiceStatus = "online" | "demo" | "unavailable" | "dry-run" | "error";

export type HealthResponse = {
  app: "online";
  gemini?: "online" | "demo" | "unavailable";
  qvac: "online" | "demo" | "unavailable";
  wdk: "online" | "dry-run" | "unavailable";
  database: "online" | "unavailable";
  environment: "Demo" | "Live";
};

export type BranchSpend = {
  branch: string;
  currentSpend: number;
  historicalAverage: number;
  deviationPercent: number;
  anomalous: boolean;
};

export type AnomalyInsight = {
  branch: string;
  currentSpend: number;
  historicalAverage: number;
  deviationPercent: number;
  severity: "medium" | "high" | "critical";
  explanation: string;
};

export type CurrentActor = {
  name: string;
  role: DemoRole;
};
