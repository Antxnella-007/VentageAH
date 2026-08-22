declare module "@qvac/sdk" {
  export const OCR_LATIN: { src?: string } | string;
  export const MODEL_TYPES: { ggmlOcr?: string };

  export function loadModel(options: {
    modelSrc: unknown;
    modelType?: string;
    modelConfig?: Record<string, unknown>;
  }): Promise<string>;

  export function ocr(params: {
    modelId: string;
    image: string | Buffer;
    options?: Record<string, unknown>;
  }): {
    blocks: Promise<{ text: string; bbox?: number[]; confidence?: number }[]>;
  };

  export function unloadModel(options: {
    modelId: string;
    clearStorage?: boolean;
  }): Promise<void>;

  export function completion(options: {
    modelId: string;
    history: { role: string; content: string }[];
    stream?: boolean;
  }): {
    final: Promise<{ contentText?: string; raw?: { fullText?: string } }>;
  };

  export function close(): Promise<void>;
}
