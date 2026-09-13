import { OCRResult } from '../domain/ocr';
import { ONNXPrivacyDetector } from '../engines/privacy/ONNXPrivacyDetector';

interface DetectRequest {
  type: 'detect';
  requestId: string;
  ocrResult: OCRResult;
}

const detector = new ONNXPrivacyDetector();

self.addEventListener('message', async (event: MessageEvent<DetectRequest>) => {
  const { type, requestId, ocrResult } = event.data;
  if (type !== 'detect') return;

  try {
    const entities = await detector.detect(ocrResult, (progress) => {
      self.postMessage({ type: 'progress', requestId, progress });
    });
    self.postMessage({ type: 'result', requestId, entities });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Sensitive information analysis failed.';
    self.postMessage({ type: 'error', requestId, message });
  }
});
