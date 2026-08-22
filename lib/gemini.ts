import { z } from "zod";
import { parseJsonObject } from "@/lib/validators";
import type { Locale } from "@/lib/i18n/dictionaries";

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
  brief: z.string().default(""),
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

const LANGUAGE: Record<Locale, string> = {
  es: "español",
  en: "English",
  pt: "português",
};

export async function analyzeInvoiceText(input: {
  text: string;
  filename: string;
  locale: Locale;
  knownBranches: string[];
  knownSuppliers: string[];
}): Promise<{ analysis: InvoiceAnalysis; model: string; usedFallback: boolean }> {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

  if (!key || !input.text.trim()) {
    return { analysis: heuristicAnalysis(input), model: "local-heuristic", usedFallback: true };
  }

  const prompt = `Eres analista AP para un grupo con varias sucursales. Responde SOLO JSON válido, sin markdown.
Idioma de brief, risks, questions y checks: ${LANGUAGE[input.locale]}.
Sucursales conocidas: ${input.knownBranches.join(", ") || "San José, Heredia, Alajuela, Cartago"}.
Proveedores ya vistos: ${input.knownSuppliers.slice(0, 20).join("; ") || "ninguno"}.
Archivo: ${input.filename}

Texto plano de la factura (ya extraído localmente, no es imagen):
"""
${input.text}
"""

JSON exacto:
{
  "invoiceNumber": "",
  "supplier": "",
  "supplierTaxId": null,
  "buyer": null,
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
  "brief": "4 frases max para CFO: qué es, a qué sucursal va, si hay algo raro, qué hacer",
  "risks": [{"code":"DUPLICATE|ROUND_AMOUNT|MISSING_TAX|LATE_FEE|BRANCH_UNCLEAR|UNUSUAL_VENDOR","detail":"","severity":"low|medium|high"}],
  "questionsForAp": ["preguntas concretas para el proveedor o AP"],
  "cashImpact": "cuándo sale la caja",
  "controllerChecks": ["3 chequeos humanos"],
  "confidence": 0.0
}`;

  try {
    const raw = await generateGeminiJson(key, model, prompt);
    const parsed = invoiceAnalysisSchema.parse(parseJsonObject(raw));
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
  if (!key) return process.env.DEMO_MODE === "false" ? "unavailable" : "demo";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}`,
      { headers: { "x-goog-api-key": key }, signal: controller.signal },
    );
    return res.ok || res.status === 200 || res.status === 404 ? "online" : "unavailable";
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timeout);
  }
}

function heuristicAnalysis(input: {
  text: string;
  filename: string;
  knownBranches: string[];
}): InvoiceAnalysis {
  const text = input.text;
  const invoiceNumber =
    text.match(/(?:invoice|factura|n[úu]mero)[:\s#]*([A-Z0-9-]{4,})/i)?.[1] ?? `UPL-${Date.now().toString(36).toUpperCase()}`;
  const totalMatch = text.match(/(?:total|importe)[:\s]*([0-9][0-9.,]*)/i);
  const total = totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : null;
  const branchGuess =
    input.knownBranches.find((branch) => text.toLowerCase().includes(branch.toLowerCase())) ?? null;

  return invoiceAnalysisSchema.parse({
    invoiceNumber,
    supplier: input.filename.replace(/\.[^.]+$/, "") || "Proveedor",
    branchGuess,
    total: Number.isFinite(total) ? total : null,
    currency: "USD",
    brief:
      "No se pudo completar Gemini. Se extrae un borrador desde el texto plano: revisa proveedor, total y sucursal a mano.",
    risks: [{ code: "MODEL_UNAVAILABLE", detail: "Análisis heurístico local.", severity: "medium" }],
    questionsForAp: ["¿El total incluye impuestos?"],
    controllerChecks: ["Validar número de factura", "Confirmar sucursal", "Confirmar vencimiento"],
    confidence: 0.25,
  });
}
