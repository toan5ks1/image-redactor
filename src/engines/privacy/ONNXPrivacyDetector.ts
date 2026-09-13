import { pipeline } from '@huggingface/transformers';
import { OCRResult } from '../../domain/ocr';
import { SensitiveEntity, EntityCategory } from '../../domain/sensitive-entity';
import {
  buildOCRDocument,
  mapDocumentRangeToLines,
} from '../mapping/OCRDocumentMapper';
import { PrivacyDetector, PrivacyDetectorProgress } from './PrivacyDetector';
import {
  PRIVACY_FILTER_INFERENCE_OPTIONS,
  PRIVACY_FILTER_MIN_CONFIDENCE,
  PRIVACY_FILTER_MODEL_ID,
  PrivacyFilterDevice,
  getPrivacyFilterPipelineOptions,
} from './PrivacyFilterConfig';

const LABEL_MAP: Record<string, EntityCategory> = {
  private_person: 'person',
  private_address: 'address',
  private_email: 'email',
  private_phone: 'phone',
  private_url: 'url',
  private_date: 'date',
  account_number: 'account',
  secret: 'secret',
  password: 'password',
};

export class ONNXPrivacyDetector implements PrivacyDetector {
  name = 'Local Sensitive Information Detector';
  private nerPipeline: any = null;
  private loadPromise: Promise<any> | null = null;
  public isLoaded = false;
  public activeDevice: PrivacyFilterDevice = 'webgpu';

  async getPipeline(onProgress?: (progress: PrivacyDetectorProgress) => void): Promise<any> {
    if (this.nerPipeline) return this.nerPipeline;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      const preferredDevice: PrivacyFilterDevice = this.hasWebGPU() ? 'webgpu' : 'wasm';

      try {
        return await this.loadPipeline(preferredDevice, onProgress);
      } catch {
        if (preferredDevice === 'wasm') {
          throw new Error('Sensitive information detection could not start on this device.');
        }

        onProgress?.({ status: 'Switching to compatibility mode…', progress: 1 });
        try {
          return await this.loadPipeline('wasm', onProgress);
        } catch {
          throw new Error('Sensitive information detection could not start on this device.');
        }
      }
    })().catch((error) => {
      this.loadPromise = null;
      throw error;
    });

    return this.loadPromise;
  }

  private async loadPipeline(
    device: PrivacyFilterDevice,
    onProgress?: (progress: PrivacyDetectorProgress) => void
  ): Promise<any> {
    this.activeDevice = device;
    onProgress?.({
      status: 'Preparing sensitive information detection…',
      progress: 1,
    });

    const ner = await pipeline('token-classification', PRIVACY_FILTER_MODEL_ID, {
      ...getPrivacyFilterPipelineOptions(device),
      progress_callback: (item: any) => {
        if (item?.status === 'progress_total' && typeof item.progress === 'number') {
          onProgress?.({
            status: `Preparing detection resources (${Math.round(item.progress)}%)…`,
            progress: Math.round(item.progress),
          });
        }
      },
    });

    this.nerPipeline = ner;
    this.isLoaded = true;
    onProgress?.({ status: 'Sensitive information detector ready', progress: 95 });
    return ner;
  }

  private hasWebGPU(): boolean {
    return typeof navigator !== 'undefined' && Boolean((navigator as any).gpu);
  }

  async detect(
    ocrResult: OCRResult,
    onProgress?: (progress: PrivacyDetectorProgress) => void,
    signal?: AbortSignal
  ): Promise<SensitiveEntity[]> {
    signal?.throwIfAborted();
    onProgress?.({ status: 'Preparing sensitive information detection…', progress: 5 });
    const ner = await this.getPipeline(onProgress);
    signal?.throwIfAborted();

    const document = buildOCRDocument(ocrResult);
    if (!document.text.trim()) return [];

    signal?.throwIfAborted();
    onProgress?.({ status: 'Analyzing recognized text…', progress: 40 });

    let outputs: any[];
    try {
      outputs = await ner(document.text, PRIVACY_FILTER_INFERENCE_OPTIONS);
    } catch (error) {
      if (signal?.aborted) signal.throwIfAborted();
      throw new Error('Sensitive information analysis could not be completed.');
    }

    signal?.throwIfAborted();
    const entities: SensitiveEntity[] = [];
    let idCounter = 1;
    let searchCursor = 0;

    for (const chunk of outputs || []) {
      const range = this.resolveChunkRange(document.text, chunk, searchCursor);
      if (range) searchCursor = Math.max(searchCursor, range.end);

      const rawKind = String(chunk.entity_group || '');
      const kind = rawKind.toLowerCase();
      const score = typeof chunk.score === 'number' ? chunk.score : Number.NaN;
      const category = LABEL_MAP[kind] || 'custom';
      if (
        !range ||
        !kind ||
        kind === 'o' ||
        !Number.isFinite(score) ||
        score < PRIVACY_FILTER_MIN_CONFIDENCE
      ) {
        continue;
      }

      const value = document.text.slice(range.start, range.end);
      const segments = mapDocumentRangeToLines(
        document,
        range.start,
        range.end,
        ocrResult.imageWidth,
        ocrResult.imageHeight
      );

      for (const segment of segments) {
        entities.push({
          id: `${segment.line.id}_onnx_${idCounter++}`,
          category,
          text: value,
          confidence: score,
          detector: 'privacy-filter',
          bbox: segment.bbox,
          lineId: segment.line.id,
          start: segment.start,
          end: segment.end,
          wordIds: segment.wordIds,
        });
      }
    }

    onProgress?.({ status: 'Privacy detection complete', progress: 100 });
    return entities;
  }

  private resolveChunkRange(
    text: string,
    chunk: { word?: unknown; start?: unknown; end?: unknown },
    cursor: number
  ): { start: number; end: number } | null {
    if (
      typeof chunk.start === 'number' &&
      typeof chunk.end === 'number' &&
      chunk.start >= 0 &&
      chunk.end > chunk.start &&
      chunk.end <= text.length
    ) {
      return this.trimRange(text, chunk.start, chunk.end);
    }

    const rawWord = String(chunk.word || '');
    const trimmedWord = rawWord.trim();
    if (!trimmedWord) return null;

    const start = text.indexOf(trimmedWord, cursor);
    if (start < 0) return null;
    return { start, end: start + trimmedWord.length };
  }

  private trimRange(text: string, start: number, end: number): { start: number; end: number } | null {
    while (start < end && /\s/.test(text[start])) start += 1;
    while (end > start && /\s/.test(text[end - 1])) end -= 1;
    return start < end ? { start, end } : null;
  }
}
