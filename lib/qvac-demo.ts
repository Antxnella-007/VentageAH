import { DEMO_INVOICE_TEMPLATES } from "@/demo-data/catalog";
import type { InvoiceExtract } from "@/lib/validators";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processInvoiceDemo(filePath: string, index = 0): Promise<{
  ocrText: string;
  fields: InvoiceExtract;
}> {
  await delay(450 + (index % 3) * 180);
  const template = DEMO_INVOICE_TEMPLATES[index % DEMO_INVOICE_TEMPLATES.length];
  const ocrText = [
    `INVOICE ${template.invoiceNumber}`,
    `Supplier: ${template.supplier}`,
    `Bill to branch: ${template.branch}`,
    `Invoice date: ${template.date}`,
    `Total due: ${template.total.toFixed(2)} ${template.currency}`,
    `Source: ${filePath.split("/").pop() ?? "upload"}`,
    "Processed locally with QVAC (demo extraction).",
  ].join("\n");

  return {
    ocrText,
    fields: { ...template },
  };
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
