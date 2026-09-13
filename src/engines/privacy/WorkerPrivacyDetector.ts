import { OCRResult } from '../../domain/ocr';
import { SensitiveEntity } from '../../domain/sensitive-entity';
import { PrivacyDetector, PrivacyDetectorProgress } from './PrivacyDetector';

type WorkerResponse =
  | { type: 'progress'; requestId: string; progress: PrivacyDetectorProgress }
  | { type: 'result'; requestId: string; entities: SensitiveEntity[] }
  | { type: 'error'; requestId: string; message: string };

export class WorkerPrivacyDetector implements PrivacyDetector {
  name = 'Local Sensitive Information Detector';
  private worker: Worker | null = null;

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('../../workers/privacy.worker.ts', import.meta.url), {
        type: 'module',
        name: 'privacy-filter-worker',
      });
    }
    return this.worker;
  }

  async detect(
    ocrResult: OCRResult,
    onProgress?: (progress: PrivacyDetectorProgress) => void,
    signal?: AbortSignal
  ): Promise<SensitiveEntity[]> {
    signal?.throwIfAborted();
    const worker = this.getWorker();
    const requestId = crypto.randomUUID();

    return new Promise<SensitiveEntity[]>((resolve, reject) => {
      const cleanup = () => {
        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleWorkerError);
        signal?.removeEventListener('abort', handleAbort);
      };

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;
        if (response.requestId !== requestId) return;
        if (response.type === 'progress') {
          onProgress?.(response.progress);
          return;
        }

        cleanup();
        if (response.type === 'result') resolve(response.entities);
        else reject(new Error(response.message));
      };

      const handleWorkerError = () => {
        cleanup();
        this.terminate();
        reject(new Error('Sensitive information analysis stopped unexpectedly.'));
      };

      const handleAbort = () => {
        cleanup();
        // Terminating is the only reliable way to interrupt an active ONNX inference.
        this.terminate();
        reject(new DOMException('Sensitive information analysis was cancelled.', 'AbortError'));
      };

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleWorkerError);
      signal?.addEventListener('abort', handleAbort, { once: true });
      worker.postMessage({ type: 'detect', requestId, ocrResult });
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
