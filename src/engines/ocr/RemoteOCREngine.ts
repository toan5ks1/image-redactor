import { OCRResult } from '../../domain/ocr';
import { OCREngine, OCREngineProgress } from './OCREngine';

/**
 * RemoteOCREngine is a pluggable remote implementation
 * reserved for future Unlimited-OCR / server-side OCR integration.
 */
export class RemoteOCREngine implements OCREngine {
  name = 'Remote Unlimited-OCR (Server)';

  constructor(private endpointUrl: string = 'https://api.ocr.example.com/recognize') {}

  async recognize(
    _image: Blob,
    _onProgress?: (progress: OCREngineProgress) => void
  ): Promise<OCRResult> {
    throw new Error(
      `Remote OCR mode is planned for Phase 2. Currently running in Local-first mode. Endpoint: ${this.endpointUrl}`
    );
  }
}
