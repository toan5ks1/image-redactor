import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OCRResult } from '../src/domain/ocr';

const mocks = vi.hoisted(() => ({
  ner: vi.fn(),
  pipeline: vi.fn(),
}));

vi.mock('@huggingface/transformers', () => ({
  env: {},
  pipeline: mocks.pipeline,
}));

import { ONNXPrivacyDetector } from '../src/engines/privacy/ONNXPrivacyDetector';

function createOCR(lines: string[]): OCRResult {
  return {
    imageWidth: 600,
    imageHeight: lines.length * 40,
    fullText: lines.join('\n'),
    lines: lines.map((text, index) => ({
      id: `line-${index + 1}`,
      text,
      bbox: [0, index * 40, 600, index * 40 + 30],
      words: [],
    })),
  };
}

describe('ONNXPrivacyDetector', () => {
  beforeEach(() => {
    mocks.ner.mockReset();
    mocks.pipeline.mockReset();
    mocks.pipeline.mockResolvedValue(mocks.ner);
    vi.stubGlobal('navigator', { gpu: {} });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('runs one inference over the full contextual OCR document', async () => {
    mocks.ner.mockResolvedValue([
      { entity_group: 'private_person', word: 'Mira Kovalenko', score: 0.97 },
    ]);
    const detector = new ONNXPrivacyDetector();
    const result = await detector.detect(createOCR(['Customer name', 'Mira Kovalenko']));

    expect(mocks.ner).toHaveBeenCalledTimes(1);
    expect(mocks.ner.mock.calls[0][0]).toBe('Customer name\nMira Kovalenko');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ category: 'person', lineId: 'line-2' });
  });

  it('maps repeated fallback chunk text with a monotonic cursor', async () => {
    mocks.ner.mockResolvedValue([
      { entity_group: 'private_email', word: 'same@example.com', score: 0.98 },
      { entity_group: 'private_email', word: 'same@example.com', score: 0.98 },
    ]);
    const detector = new ONNXPrivacyDetector();
    const result = await detector.detect(
      createOCR(['same@example.com then same@example.com'])
    );

    expect(result).toHaveLength(2);
    expect(result.map((entity) => entity.start)).toEqual([0, 22]);
    expect(result[0].bbox).not.toEqual(result[1].bbox);
  });

  it('skips an unmatched model chunk instead of masking the full line', async () => {
    mocks.ner.mockResolvedValue([
      { entity_group: 'private_person', word: 'text not present', score: 0.99 },
    ]);
    const detector = new ONNXPrivacyDetector();

    await expect(detector.detect(createOCR(['ordinary public text']))).resolves.toEqual([]);
  });

  it('uses the reference app confidence threshold for every model category', async () => {
    mocks.ner.mockResolvedValue([
      { entity_group: 'private_person', word: 'Public', score: 0.89 },
      { entity_group: 'secret', word: 'TrOub4dor_2026', score: 0.864 },
      { entity_group: 'private_person', word: 'Person', score: 0.9 },
    ]);
    const detector = new ONNXPrivacyDetector();
    const result = await detector.detect(createOCR(['Public TrOub4dor_2026 Person']));

    expect(result.map((entity) => entity.text)).toEqual(['Person']);
  });

  it('uses the reference WebGPU q4 pipeline configuration', async () => {
    const detector = new ONNXPrivacyDetector();

    await detector.getPipeline();

    expect(mocks.pipeline).toHaveBeenCalledTimes(1);
    expect(mocks.pipeline).toHaveBeenCalledWith(
      'token-classification',
      'openai/privacy-filter',
      expect.objectContaining({
        device: 'webgpu',
        dtype: 'q4',
        progress_callback: expect.any(Function),
      })
    );
    expect(detector.activeDevice).toBe('webgpu');
  });

  it('uses WASM directly when WebGPU is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const detector = new ONNXPrivacyDetector();

    await detector.getPipeline();

    expect(mocks.pipeline).toHaveBeenCalledTimes(1);
    expect(mocks.pipeline).toHaveBeenCalledWith(
      'token-classification',
      'openai/privacy-filter',
      expect.objectContaining({ device: 'wasm', dtype: 'q4' })
    );
    expect(detector.activeDevice).toBe('wasm');
  });

  it('falls back to WASM when WebGPU initialization fails', async () => {
    mocks.pipeline.mockRejectedValueOnce(new Error('adapter unavailable'));
    const detector = new ONNXPrivacyDetector();

    await expect(detector.getPipeline()).resolves.toBe(mocks.ner);
    expect(mocks.pipeline).toHaveBeenCalledTimes(2);
    expect(mocks.pipeline.mock.calls[0][2]).toEqual(
      expect.objectContaining({ device: 'webgpu', dtype: 'q4' })
    );
    expect(mocks.pipeline.mock.calls[1][2]).toEqual(
      expect.objectContaining({ device: 'wasm', dtype: 'q4' })
    );
    expect(detector.activeDevice).toBe('wasm');
  });

});
