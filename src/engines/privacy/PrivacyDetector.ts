import { SensitiveEntity } from '../../domain/sensitive-entity';
import { OCRResult } from '../../domain/ocr';

export interface PrivacyDetectorProgress {
  status: string;
  progress: number; // 0 to 100
}

export interface PrivacyDetector {
  name: string;
  detect(
    ocrResult: OCRResult,
    onProgress?: (progress: PrivacyDetectorProgress) => void,
    signal?: AbortSignal
  ): Promise<SensitiveEntity[]>;
}
