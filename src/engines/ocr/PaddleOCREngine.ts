import { OCRResult } from "../../domain/ocr";
import { OCREngine, OCREngineProgress } from "./OCREngine";

type WorkerResponse =
  | { type: "progress"; requestId: string; progress: OCREngineProgress }
  | { type: "result"; requestId: string; result: OCRResult }
  | { type: "error"; requestId: string; message: string };

export class PaddleOCREngine implements OCREngine {
  name = 'Local Text Scanner';
  private worker: Worker | null = null;

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL("../../workers/ocr.worker.ts", import.meta.url),
        {
          type: "module",
          name: "paddle-ocr-worker",
        },
      );
    }
    return this.worker;
  }

  async recognize(
    image: Blob,
    onProgress?: (progress: OCREngineProgress) => void,
    signal?: AbortSignal,
  ): Promise<OCRResult> {
    signal?.throwIfAborted();
    const worker = this.getWorker();
    const requestId = crypto.randomUUID();

    return new Promise<OCRResult>((resolve, reject) => {
      const cleanup = () => {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleWorkerError);
        signal?.removeEventListener("abort", handleAbort);
      };

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;
        if (response.requestId !== requestId) return;
        if (response.type === "progress") {
          onProgress?.(response.progress);
          return;
        }

        cleanup();
        if (response.type === "result") resolve(response.result);
        else reject(new Error(response.message));
      };

      const handleWorkerError = () => {
        cleanup();
        void this.terminate();
        reject(
          new Error(
            'Text recognition stopped unexpectedly.',
          ),
        );
      };

      const handleAbort = () => {
        cleanup();
        void this.terminate();
        reject(new DOMException("OCR processing was cancelled.", "AbortError"));
      };

      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleWorkerError);
      signal?.addEventListener("abort", handleAbort, { once: true });
      worker.postMessage({ type: "recognize", requestId, image });
    });
  }

  async terminate(): Promise<void> {
    this.worker?.terminate();
    this.worker = null;
  }
}
