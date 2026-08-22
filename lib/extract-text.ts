import { PDFParse } from "pdf-parse";
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
    const parser = new PDFParse({ data: new Uint8Array(input.buffer) });
    try {
      const result = await parser.getText();
      const clipped = clip(result.text);
      return {
        ...clipped,
        method: clipped.text.length > 20 ? "pdf" : "empty",
        pages: result.pages?.length,
      };
    } finally {
      await parser.destroy?.();
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
