import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MAX_UPLOAD_BYTES } from "@/lib/validators";

const UPLOAD_ROOT = process.env.VERCEL
  ? path.join(os.tmpdir(), "billspark-uploads")
  : path.join(process.cwd(), "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/json": ".json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

export async function storeUpload(file: File): Promise<{
  storedName: string;
  absolutePath: string;
  originalFilename: string;
  buffer: Buffer;
}> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await storeBuffer(buffer, file.name, file.type);
  return { ...stored, buffer };
}

export async function storeBuffer(
  buffer: Buffer,
  filename: string,
  mime: string,
): Promise<{ storedName: string; absolutePath: string; originalFilename: string }> {
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("Each document must be 10 MB or smaller.");
  }

  await mkdir(UPLOAD_ROOT, { recursive: true });

  const original = path.basename(filename).replace(/[^\w.\- ]+/g, "");
  const extFromName = path.extname(original).toLowerCase();
  const ext =
    EXT_BY_MIME[mime] ??
    ([".png", ".jpg", ".jpeg", ".webp", ".pdf", ".txt", ".csv", ".json", ".docx"].includes(extFromName)
      ? extFromName
      : ".bin");
  const storedName = `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;
  const absolutePath = path.join(UPLOAD_ROOT, storedName);

  if (!absolutePath.startsWith(UPLOAD_ROOT)) {
    throw new Error("Invalid upload path.");
  }

  await writeFile(absolutePath, buffer);
  return { storedName, absolutePath, originalFilename: original };
}

export function uploadAbsolutePath(storedName: string): string {
  const safe = path.basename(storedName);
  return path.join(UPLOAD_ROOT, safe);
}
