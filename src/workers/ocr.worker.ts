import { PaddleOcrService, V6_SMALL_MODEL } from 'ppu-paddle-ocr/web';
import { normalizePaddleResult } from '../engines/ocr/normalizePaddleResult';

interface RecognizeRequest {
  type: 'recognize';
  requestId: string;
  image: Blob;
}

let service: PaddleOcrService | null = null;
let servicePromise: Promise<PaddleOcrService> | null = null;

async function getService(requestId: string): Promise<PaddleOcrService> {
  if (service) return service;
  if (servicePromise) return servicePromise;

  self.postMessage({
    type: 'progress',
    requestId,
    progress: { status: 'Preparing text recognition…', progress: 10 },
  });

  servicePromise = (async () => {
    const nextService = new PaddleOcrService({
      model: V6_SMALL_MODEL,
    });
    await nextService.initialize();
    service = nextService;
    return nextService;
  })().catch(() => {
    servicePromise = null;
    throw new Error('Text recognition could not start on this device.');
  });

  return servicePromise;
}

self.addEventListener('message', async (event: MessageEvent<RecognizeRequest>) => {
  const { type, requestId, image } = event.data;
  if (type !== 'recognize') return;

  let bitmap: ImageBitmap | null = null;
  try {
    const ocrService = await getService(requestId);
    self.postMessage({
      type: 'progress',
      requestId,
      progress: { status: 'Decoding screenshot in OCR worker…', progress: 45 },
    });

    bitmap = await createImageBitmap(image);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('OCR worker could not create an image canvas.');
    context.drawImage(bitmap, 0, 0);

    self.postMessage({
      type: 'progress',
      requestId,
      progress: { status: 'Detecting and recognizing text…', progress: 55 },
    });
    const rawResult = await ocrService.recognize(canvas, {
      flatten: true,
      strategy: 'per-box',
    });

    self.postMessage({
      type: 'progress',
      requestId,
      progress: { status: 'Normalizing OCR text geometry…', progress: 90 },
    });
    const result = normalizePaddleResult(rawResult, bitmap.width, bitmap.height);
    self.postMessage({ type: 'result', requestId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OCR processing failed.';
    self.postMessage({ type: 'error', requestId, message });
  } finally {
    bitmap?.close();
  }
});
