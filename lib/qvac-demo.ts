import { createHash } from "node:crypto";
import { DEMO_INVOICE_TEMPLATES } from "@/demo-data/catalog";
import type { InvoiceExtract } from "@/lib/validators";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 6).toUpperCase();
}

export async function processInvoiceDemo(
  filePath: string,
  index = 0,
  originalFilename?: string,
): Promise<{
  ocrText: string;
  fields: InvoiceExtract;
}> {
  await delay(450 + (index % 3) * 180);
  const template = DEMO_INVOICE_TEMPLATES[index % DEMO_INVOICE_TEMPLATES.length];
  const source = originalFilename || filePath.split("/").pop() || `upload-${index}`;
  const unique = shortId(`${source}:${Date.now()}:${index}:${Math.random()}`);
  const amountJitter = (Number.parseInt(unique.slice(0, 2), 16) % 350) + 40;
  const fields: InvoiceExtract = {
    ...template,
    invoiceNumber: `UPL-${unique}`,
    total: Math.round((template.total + amountJitter) * 100) / 100,
    date: new Date().toISOString().slice(0, 10),
  };
  const ocrText = [
    `INVOICE ${fields.invoiceNumber}`,
    `Supplier: ${fields.supplier}`,
    `Bill to branch: ${fields.branch}`,
    `Invoice date: ${fields.date}`,
    `Total due: ${fields.total.toFixed(2)} ${fields.currency}`,
    `Source file: ${source}`,
    "Processed locally with QVAC (demo extraction).",
  ].join("\n");

  return { ocrText, fields };
}

export function explainAnomalyDemo(input: {
  branch: string;
  deviationPercent: number;
  currentSpend: number;
  historicalAverage: number;
}): string {
  return `${input.branch} is spending ${input.deviationPercent.toFixed(1)}% above its historical monthly average of $${input.historicalAverage.toLocaleString("en-US")}. Current spend is $${input.currentSpend.toLocaleString("en-US")}. The increase is primarily concentrated in technology and infrastructure suppliers.`;
}

export function extractInvoiceFieldsDemo(text: string): InvoiceExtract {
  const invoiceNumber = text.match(/INVOICE\s+([A-Z0-9-]+)/i)?.[1] ?? "UNK-0000";
  const supplier = text.match(/Supplier:\s*(.+)/i)?.[1]?.trim() ?? "Unknown Supplier";
  const branch = text.match(/branch:\s*(.+)/i)?.[1]?.trim() ?? "San José";
  const date = text.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "2026-08-01";
  const totalMatch = text.match(/Total due:\s*([0-9,.]+)/i);
  const total = totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : 100;
  return {
    invoiceNumber,
    supplier,
    branch,
    date,
    total: Number.isFinite(total) ? total : 100,
    currency: "USD",
  };
}
