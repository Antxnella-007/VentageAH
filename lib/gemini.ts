import { z } from "zod";
import { parseJsonObject } from "@/lib/validators";

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

export async function analyzeInvoiceText(input: {
  text: string;
  filename: string;
  folderPath?: string;
  knownCompanies: string[];
  knownBranches: string[];
  knownSuppliers: string[];
}): Promise<{ analysis: InvoiceAnalysis; model: string; usedFallback: boolean }> {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

  if (!key || !input.text.trim()) {
    return { analysis: heuristicAnalysis(input), model: "local-heuristic", usedFallback: true };
  }

  const prompt = `You are an AP analyst for a large group with many companies and branches. Return ONLY valid JSON. All prose in English.
Known companies: ${input.knownCompanies.join(", ") || "Pacific Retail Group"}.
Known branches: ${input.knownBranches.join(", ") || "San José, Heredia, Alajuela, Cartago"}.
Known suppliers: ${input.knownSuppliers.slice(0, 20).join("; ") || "none"}.
File: ${input.filename}
Folder path (company / branch clues): ${input.folderPath || "none"}.

Plain text already extracted locally (not an image):
"""
${input.text}
"""

JSON shape:
{
  "invoiceNumber": "",
  "supplier": "",
  "supplierTaxId": null,
  "buyer": null,
  "companyGuess": null,
  "branchGuess": null,
  "date": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "subtotal": null,
  "taxAmount": null,
  "total": null,
  "currency": "USD",
  "paymentTerms": null,
  "category": null,
  "costCenterGuess": null,
  "lineItems": [{"description":"","qty":null,"amount":null}],
  "summary": "2 short sentences a busy AP clerk can read",
  "brief": "3 sentences: what this bill is, which branch, what is unusual",
  "advice": ["4 practical next steps based on THIS invoice"],
  "risks": [{"code":"DUPLICATE|ROUND_AMOUNT|MISSING_TAX|LATE_FEE|BRANCH_UNCLEAR|UNUSUAL_VENDOR|PO_MISMATCH","detail":"","severity":"low|medium|high"}],
  "questionsForAp": ["specific questions for the vendor or AP"],
  "cashImpact": "when cash leaves and why it matters",
  "controllerChecks": ["3 human checks"],
  "confidence": 0.0
}`;

  try {
    const raw = await generateGeminiJson(key, model, prompt);
    const parsed = invoiceAnalysisSchema.parse(parseJsonObject(raw));
    if (!parsed.summary) parsed.summary = parsed.brief;
    if (parsed.advice.length === 0) parsed.advice = parsed.controllerChecks.slice(0, 4);
    return { analysis: parsed, model, usedFallback: false };
  } catch (error) {
    console.error("Gemini analysis failed; using heuristic.", error instanceof Error ? error.message : "error");
    return { analysis: heuristicAnalysis(input), model: "local-heuristic", usedFallback: true };
  }
}

async function generateGeminiJson(apiKey: string, model: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${detail.slice(0, 180)}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

export async function checkGeminiHealth(): Promise<"online" | "demo" | "unavailable"> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "unavailable";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, {
      headers: { "x-goog-api-key": key },
      signal: controller.signal,
    });
    return res.ok || res.status === 404 ? "online" : "unavailable";
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timeout);
  }
}

function heuristicAnalysis(input: {
  text: string;
  filename: string;
  folderPath?: string;
  knownCompanies?: string[];
  knownBranches: string[];
}): InvoiceAnalysis {
  const text = input.text;
  const invoiceNumber =
    text.match(/(?:invoice|factura|number)[:\s#]*([A-Z0-9-]{4,})/i)?.[1] ??
    `UPL-${Date.now().toString(36).toUpperCase()}`;
  const totalMatch = text.match(/(?:total)[:\s]*([0-9][0-9.,]*)/i);
  const total = totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : null;
  const haystack = `${text} ${input.filename} ${input.folderPath ?? ""}`.toLowerCase();
  const branchGuess =
    input.knownBranches.find((branch) => haystack.includes(branch.toLowerCase())) ?? null;
  const companyGuess =
    input.knownCompanies?.find((company) => haystack.includes(company.toLowerCase())) ?? null;

  return invoiceAnalysisSchema.parse({
    invoiceNumber,
    supplier: input.filename.replace(/\.[^.]+$/, "") || "Unknown supplier",
    companyGuess,
    branchGuess,
    total: Number.isFinite(total) ? total : null,
    currency: "USD",
    summary: "Gemini was unavailable. This is a local draft from the extracted plain text.",
    brief: "Review supplier, total, and due date by hand before posting.",
    advice: [
      "Confirm the total includes tax.",
      "Match the invoice to a purchase order.",
      "Assign the correct branch before posting.",
    ],
    risks: [{ code: "MODEL_UNAVAILABLE", detail: "Local draft only.", severity: "medium" }],
    questionsForAp: ["Does this total include tax?"],
    controllerChecks: ["Verify invoice number", "Confirm branch", "Confirm due date"],
    confidence: 0.25,
  });
}
