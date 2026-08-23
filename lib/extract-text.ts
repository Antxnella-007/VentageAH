import mammoth from "mammoth";
import { createWorker } from "tesseract.js";

const MAX_CHARS = Number(process.env.GEMINI_MAX_CHARS ?? 8000);

export type ExtractionResult = {
  text: string;
  method: "pdf" | "docx" | "text" | "ocr" | "empty";
  pages?: number;
  originalLength: number;
  sentLength: number;
};

function compact(text: string): string {
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function clip(text: string): { text: string; originalLength: number; sentLength: number } {
  const cleaned = compact(text);
  return {
    text: cleaned.slice(0, MAX_CHARS),
    originalLength: cleaned.length,
    sentLength: Math.min(cleaned.length, MAX_CHARS),
  };
}

export async function extractPlainText(input: {
  buffer: Buffer;
  filename: string;
  mime: string;
}): Promise<ExtractionResult> {
  try {
    return await extractPlainTextInner(input);
  } catch {
    return { text: "", method: "empty", originalLength: 0, sentLength: 0 };
  }
}

async function extractPlainTextInner(input: {
  buffer: Buffer;
  filename: string;
  mime: string;
}): Promise<ExtractionResult> {
  const name = input.filename.toLowerCase();
  const mime = input.mime.toLowerCase();

  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    try {
      const text = await extractPdfText(input.buffer);
      const clipped = clip(text);
      return {
        ...clipped,
        method: clipped.text.length > 20 ? "pdf" : "empty",
      };
    } catch {
      return { text: "", method: "empty", originalLength: 0, sentLength: 0 };
    }
  }

  if (
    mime.includes("word") ||
    name.endsWith(".docx") ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer: input.buffer });
    const clipped = clip(result.value);
    return { ...clipped, method: clipped.text.length > 20 ? "docx" : "empty" };
  }

  if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".csv") || name.endsWith(".json")) {
    const clipped = clip(input.buffer.toString("utf8"));
    return { ...clipped, method: "text" };
  }

  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(name)) {
    try {
      const worker = await createWorker("eng");
      try {
        const { data } = await worker.recognize(input.buffer);
        const clipped = clip(data.text ?? "");
        return { ...clipped, method: clipped.text.length > 12 ? "ocr" : "empty" };
      } finally {
        await worker.terminate();
      }
    } catch {
      return { text: "", method: "empty", originalLength: 0, sentLength: 0 };
    }
  }

  const clipped = clip(input.buffer.toString("utf8"));
  return { ...clipped, method: clipped.text.length > 20 ? "text" : "empty" };
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const unpdf = await import("unpdf");
    const pdf = await unpdf.getDocumentProxy(new Uint8Array(buffer));
    const extracted = await unpdf.extractText(pdf, { mergePages: true });
    const text = Array.isArray(extracted.text) ? extracted.text.join("\n") : extracted.text;
    if (text && text.replace(/\s+/g, "").length > 12) return text;
  } catch {
    // Fall through to a lightweight scrape so the route still loads on Vercel.
  }
  return scrapePdfLiterals(buffer);
}

function scrapePdfLiterals(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const chunks: string[] = [];
  const pattern = /\((?:\\.|[^\\)]){2,}\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    const inner = match[0]
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\t/g, " ")
      .replace(/\\(.)/g, "$1");
    if (/[A-Za-z0-9]/.test(inner)) chunks.push(inner);
  }
  return chunks.join(" ");
}
