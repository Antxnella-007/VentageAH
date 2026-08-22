import {
  getQvacBaseUrl,
  getQvacModel,
  isDemoMode,
} from "@/lib/config";
import {
  explainAnomalyDemo,
  extractInvoiceFieldsDemo,
  processInvoiceDemo,
} from "@/lib/qvac-demo";
import {
  invoiceExtractSchema,
  parseJsonObject,
  type InvoiceExtract,
} from "@/lib/validators";

export type QvacHealth = {
  status: "online" | "demo" | "unavailable";
  detail: string;
};

export type ProcessInvoiceResult = {
  ocrText: string;
  fields: InvoiceExtract;
  mode: "qvac" | "demo";
};

let ocrModelId: string | null = null;
let completionModelId: string | null = null;

async function loadSdk() {
  try {
    const loader = Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<typeof import("@qvac/sdk")>;
    return await loader("@qvac/sdk");
  } catch {
    return null;
  }
}

export async function checkQvacHealth(): Promise<QvacHealth> {
  const sdk = await loadSdk();
  const httpOk = await checkQvacHttp();

  if (httpOk || sdk) {
    return {
      status: "online",
      detail: httpOk
        ? "QVAC HTTP server responded."
        : "QVAC SDK is available locally.",
    };
  }

  if (isDemoMode()) {
    return {
      status: "demo",
      detail: "QVAC is running in demo mode. Documents are processed locally with a deterministic extractor.",
    };
  }

  return {
    status: "unavailable",
    detail: "QVAC SDK and local HTTP server were not detected.",
  };
}

async function checkQvacHttp(): Promise<boolean> {
  const base = getQvacBaseUrl().replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`${base}/models`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function processInvoice(
  filePath: string,
  index = 0,
): Promise<ProcessInvoiceResult> {
  if (isDemoMode()) {
    const demo = await processInvoiceDemo(filePath, index);
    return { ...demo, mode: "demo" };
  }

  try {
    const ocrText = await ocrInvoice(filePath);
    const fields = await extractInvoiceFields(ocrText);
    return { ocrText, fields, mode: "qvac" };
  } catch (error) {
    console.error("QVAC invoice processing failed; using local fallback.", sanitizeError(error));
    const demo = await processInvoiceDemo(filePath, index);
    return { ...demo, mode: "demo" };
  }
}

export async function extractInvoiceFields(text: string): Promise<InvoiceExtract> {
  if (isDemoMode()) {
    return extractInvoiceFieldsDemo(text);
  }

  const fromHttp = await extractViaHttp(text);
  if (fromHttp) return fromHttp;

  const fromSdk = await extractViaSdk(text);
  if (fromSdk) return fromSdk;

  return extractInvoiceFieldsDemo(text);
}

export async function explainAnomaly(anomaly: {
  branch: string;
  currentSpend: number;
  historicalAverage: number;
  deviationPercent: number;
}): Promise<string> {
  const prompt = `Explain this treasury anomaly in two sentences for a CFO. Return plain text only.
Branch: ${anomaly.branch}
Current spend: ${anomaly.currentSpend}
Historical average: ${anomaly.historicalAverage}
Deviation percent: ${anomaly.deviationPercent.toFixed(1)}
Mention that the increase is concentrated in technology and infrastructure suppliers if relevant.`;

  if (!isDemoMode()) {
    const httpText = await completeViaHttp(prompt);
    if (httpText) return httpText.trim();
    const sdkText = await completeViaSdk(prompt);
    if (sdkText) return sdkText.trim();
  }

  return explainAnomalyDemo(anomaly);
}

async function ocrInvoice(filePath: string): Promise<string> {
  if (filePath.toLowerCase().endsWith(".pdf")) {
    // Official QVAC OCR operates on images. PDF page rasterization is a
    // future adapter step — do not invent unsupported SDK PDF APIs.
    throw new Error("PDF OCR requires page-to-image conversion, which is not enabled in this MVP.");
  }

  const sdk = await loadSdk();
  if (!sdk) {
    throw new Error("QVAC SDK is not installed.");
  }

  if (!ocrModelId) {
    const modelSrc = sdk.OCR_LATIN;
    ocrModelId = await sdk.loadModel({
      modelSrc,
      modelType: sdk.MODEL_TYPES?.ggmlOcr ?? "ggml-ocr",
    });
  }

  const { blocks } = sdk.ocr({ modelId: ocrModelId, image: filePath });
  const result = await blocks;
  return result.map((block) => block.text).join("\n");
}

async function extractViaHttp(text: string): Promise<InvoiceExtract | null> {
  const content = await completeViaHttp(
    `Extract invoice fields from the OCR text. Return JSON only with keys invoiceNumber, supplier, branch, date (YYYY-MM-DD), total (number), currency.
OCR:
${text.slice(0, 4000)}`,
  );
  if (!content) return null;
  try {
    return invoiceExtractSchema.parse(parseJsonObject(content));
  } catch {
    return null;
  }
}

async function extractViaSdk(text: string): Promise<InvoiceExtract | null> {
  const content = await completeViaSdk(
    `Extract invoice fields from the OCR text. Return JSON only with keys invoiceNumber, supplier, branch, date (YYYY-MM-DD), total (number), currency.
OCR:
${text.slice(0, 4000)}`,
  );
  if (!content) return null;
  try {
    return invoiceExtractSchema.parse(parseJsonObject(content));
  } catch {
    return null;
  }
}

async function completeViaHttp(prompt: string): Promise<string | null> {
  const base = getQvacBaseUrl().replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: getQvacModel(),
        temperature: 0,
        messages: [
          {
            role: "system",
            content: "You are a local financial document assistant running on QVAC. Reply concisely.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return json.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function completeViaSdk(prompt: string): Promise<string | null> {
  const sdk = await loadSdk();
  if (!sdk) return null;
  try {
    if (!completionModelId) {
      // TODO: bind a local GGUF / registry completion model when one is configured.
      return null;
    }
    const result = sdk.completion({
      modelId: completionModelId,
      history: [{ role: "user", content: prompt }],
    });
    const final = await result.final;
    return final.contentText ?? final.raw?.fullText ?? null;
  } catch {
    return null;
  }
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 180);
  return "unknown error";
}
