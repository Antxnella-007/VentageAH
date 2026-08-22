import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAX_UPLOAD_BYTES } from "@/lib/validators";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "application/pdf": ".pdf",
};

export async function storeUpload(file: File): Promise<{
  storedName: string;
  absolutePath: string;
  originalFilename: string;
}> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Each document must be 10 MB or smaller.");
  }

  await mkdir(UPLOAD_ROOT, { recursive: true });

  const original = path.basename(file.name).replace(/[^\w.\- ]+/g, "");
  const extFromName = path.extname(original).toLowerCase();
  const ext = EXT_BY_MIME[file.type] ?? ([".png", ".jpg", ".jpeg", ".pdf"].includes(extFromName) ? extFromName : ".bin");
  const storedName = `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;
  const absolutePath = path.join(UPLOAD_ROOT, storedName);

  if (!absolutePath.startsWith(UPLOAD_ROOT)) {
    throw new Error("Invalid upload path.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return { storedName, absolutePath, originalFilename: original };
}

export function uploadAbsolutePath(storedName: string): string {
  const safe = path.basename(storedName);
  return path.join(UPLOAD_ROOT, safe);
}
