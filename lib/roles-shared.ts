import { z } from "zod";

export const DEMO_ROLES = [
  "Finance Analyst",
  "CFO",
  "Controller",
] as const;

export type DemoRole = (typeof DEMO_ROLES)[number];

export const demoRoleSchema = z.enum(DEMO_ROLES);

export const ROLE_ACTORS: Record<DemoRole, { name: string }> = {
  "Finance Analyst": { name: "Elena Castro" },
  CFO: { name: "Maria Rodriguez" },
  Controller: { name: "Daniel Vega" },
};

export const ROLE_COOKIE = "vantage-role";

export function canApprove(role: DemoRole): boolean {
  return role === "CFO" || role === "Controller";
}

export function canUploadInvoices(_role: DemoRole): boolean {
  return true;
}

export function canExecutePayments(role: DemoRole): boolean {
  return role === "CFO" || role === "Controller";
}

export function actorFor(role: DemoRole): { name: string; role: DemoRole } {
  return { name: ROLE_ACTORS[role].name, role };
}
