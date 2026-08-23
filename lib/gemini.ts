import "server-only";
import { parseJsonObject } from "@/lib/validators";
import { invoiceAnalysisSchema, type InvoiceAnalysis } from "@/lib/invoice-schema";

export type { InvoiceAnalysis };
export { invoiceAnalysisSchema };

function redact(text: string) {
  const key = process.env.GEMINI_API_KEY;
  let out = text;
  if (key) out = out.split(key).join("[redacted]");
  return out.replace(/AQ\.[A-Za-z0-9_-]+/g, "[redacted]").replace(/AIza[A-Za-z0-9_-]+/g, "[redacted]");
}

export async function analyzeInvoiceText(input: {
  text: string;
  filename: string;
  folderPath?: string;
  knownCompanies: string[];
  knownBranches: string[];
  knownSuppliers: string[];
}): Promise<{ analysis: InvoiceAnalysis; model: string; usedFallback: boolean }> {
  const key = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

  if (!key) {
    console.error("Invoice reader is not configured: GEMINI_API_KEY is missing.");
    return { analysis: heuristicAnalysis(input, "missing-key"), model: "unconfigured", usedFallback: true };
  }
  if (!input.text.trim()) {
    return { analysis: heuristicAnalysis(input, "empty-text"), model: "empty", usedFallback: true };
  }

  const prompt = `You are an AP analyst for a large group with many companies and branches. Return ONLY valid JSON. All prose in English.
Known companies: ${input.knownCompanies.join(", ") || "Pacific Retail Group"}.
Known branches: ${input.knownBranches.join(", ") || "San José, Heredia, Alajuela, Cartago"}.
Known suppliers: ${input.knownSuppliers.slice(0, 20).join("; ") || "none"}.
File: ${input.filename}
Folder path (company / branch clues): ${input.folderPath || "none"}.

Invoice text:
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
    console.error("Invoice reader failed; using local draft.", redact(error instanceof Error ? error.message : "error"));
    return { analysis: heuristicAnalysis(input, "reader-failed"), model: "fallback", usedFallback: true };
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
    throw new Error(`Reader HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text) throw new Error("Empty reader response");
  return text;
}

export async function checkGeminiHealth(): Promise<"online" | "demo" | "unavailable"> {
  const key = process.env.GEMINI_API_KEY?.trim();
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

function heuristicAnalysis(
  input: {
    text: string;
    filename: string;
    folderPath?: string;
    knownCompanies?: string[];
    knownBranches: string[];
  },
  reason: "missing-key" | "empty-text" | "reader-failed",
): InvoiceAnalysis {
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

  const detail =
    reason === "missing-key"
      ? "Automatic reading is not configured. Add GEMINI_API_KEY to .env.local."
      : reason === "empty-text"
        ? "No readable text was found in this file."
        : "Automatic reading failed. Review this invoice by hand.";

  return invoiceAnalysisSchema.parse({
    invoiceNumber,
    supplier: input.filename.replace(/\.[^.]+$/, "") || "Unknown supplier",
    companyGuess,
    branchGuess,
    total: Number.isFinite(total) ? total : null,
    currency: "USD",
    summary: "This invoice was saved as a local draft until a full read succeeds.",
    brief: "Review supplier, total, and due date by hand before posting.",
    advice: [
      "Confirm the total includes tax.",
      "Match the invoice to a purchase order.",
      "Assign the correct branch before posting.",
    ],
    risks: [{ code: "NEEDS_REVIEW", detail, severity: "medium" }],
    questionsForAp: ["Does this total include tax?"],
    controllerChecks: ["Verify invoice number", "Confirm branch", "Confirm due date"],
    confidence: 0.25,
  });
}
