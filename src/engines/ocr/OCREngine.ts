import { OCRResult } from '../../domain/ocr';

export interface OCREngineProgress {
  status: string;
  progress: number; // 0 to 100
}

export interface OCREngine {
  name: string;
  recognize(
    image: Blob,
    onProgress?: (progress: OCREngineProgress) => void,
    signal?: AbortSignal
  ): Promise<OCRResult>;
  terminate?(): Promise<void>;
}
