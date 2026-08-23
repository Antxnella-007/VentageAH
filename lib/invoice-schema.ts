import { z } from "zod";

const lineItemSchema = z.object({
  description: z.string(),
  qty: z.number().nullable().optional(),
  amount: z.number().nullable().optional(),
});

export const invoiceAnalysisSchema = z.object({
  invoiceNumber: z.string().default("—"),
  supplier: z.string().default("—"),
  supplierTaxId: z.string().nullable().optional(),
  buyer: z.string().nullable().optional(),
  companyGuess: z.string().nullable().optional(),
  branchGuess: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  subtotal: z.number().nullable().optional(),
  taxAmount: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
  currency: z.string().default("USD"),
  paymentTerms: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  costCenterGuess: z.string().nullable().optional(),
  lineItems: z.array(lineItemSchema).default([]),
  summary: z.string().default(""),
  brief: z.string().default(""),
  advice: z.array(z.string()).default([]),
  risks: z
    .array(
      z.object({
        code: z.string(),
        detail: z.string(),
        severity: z.enum(["low", "medium", "high"]),
      }),
    )
    .default([]),
  questionsForAp: z.array(z.string()).default([]),
  cashImpact: z.string().nullable().optional(),
  controllerChecks: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type InvoiceAnalysis = z.infer<typeof invoiceAnalysisSchema>;
