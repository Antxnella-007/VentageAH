import { z } from "zod";

export const invoiceExtractSchema = z.object({
  invoiceNumber: z.string().min(1).max(64),
  supplier: z.string().min(1).max(120),
  branch: z.string().min(1).max(80),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  total: z.number().positive("Invoice total must be greater than zero"),
  currency: z.string().min(3).max(8).default("USD"),
});

export type InvoiceExtract = z.infer<typeof invoiceExtractSchema>;

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".pdf", ".txt", ".csv", ".json", ".docx"]);

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_BATCH_FILES = 80;

export function validateUploadFile(file: {
  name: string;
  type: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  if (file.size <= 0) {
    return { ok: false, error: "Empty files cannot be uploaded." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Each document must be 10 MB or smaller." };
  }

  const lower = file.name.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));
  if (!ALLOWED_EXT.has(ext)) {
    return { ok: false, error: "Accepted formats: PNG, JPG, PDF, TXT, CSV, DOCX." };
  }

  if (file.type && !ALLOWED_MIME.has(file.type) && file.type !== "application/octet-stream") {
    return { ok: false, error: "File type is not an accepted invoice format." };
  }

  return { ok: true };
}

export const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Destination must be a 42-character 0x address.");

export const paymentRequestSchema = z.object({
  to: ethereumAddressSchema,
  amount: z.number().positive("Payment amount must be greater than zero"),
  token: z.string().min(1).max(16),
  network: z.enum(["ethereum"]),
  wallet: z.string().min(1).max(80),
});

export const batchIdSchema = z.string().min(1).max(80);

export const approvalRoleSchema = z.enum(["CFO", "Controller"]);

export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model output did not contain JSON.");
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}
