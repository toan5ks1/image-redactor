import { describe, expect, it } from 'vitest';
import { normalizePaddleResult } from '../src/engines/ocr/normalizePaddleResult';
import {
  buildOCRDocument,
  mapDocumentRangeToLines,
} from '../src/engines/mapping/OCRDocumentMapper';

describe('normalizePaddleResult', () => {
  it('keeps horizontally aligned table cells as separate logical lines', () => {
    const result = normalizePaddleResult(
      {
        results: [
          {
            text: 'external-id',
            confidence: 0.98,
            box: { x: 346, y: 566, width: 173, height: 32 },
          },
          {
            text: '014554068909',
            confidence: 0.99,
            box: { x: 547, y: 574, width: 104, height: 23 },
          },
          {
            text: '2026-01-22 23:54:35',
            confidence: 0.97,
            box: { x: 721, y: 577, width: 139, height: 18 },
          },
        ],
      },
      1918,
      1019
    );

    expect(result.lines).toHaveLength(3);
    expect(result.lines.map((line) => line.text)).toEqual([
      'external-id',
      '014554068909',
      '2026-01-22 23:54:35',
    ]);
    expect(result.lines[1].bbox).toEqual([547, 574, 651, 597]);
    expect(result.lines[1].words).toHaveLength(1);
    expect(result.fullText).toBe(
      'external-id\n014554068909\n2026-01-22 23:54:35'
    );
  });

  it('preserves adjacent OCR regions without guessing that they are one token', () => {
    const result = normalizePaddleResult(
      {
        results: [
          { text: 'token=fake-82K', box: { x: 75, y: 410, width: 255, height: 40 } },
          { text: 'lmQp9.', box: { x: 332, y: 411, width: 92, height: 39 } },
        ],
      },
      1000,
      700
    );

    expect(result.lines).toHaveLength(2);
    expect(result.lines.map((line) => line.text)).toEqual([
      'token=fake-82K',
      'lmQp9.',
    ]);
    expect(result.lines.map((line) => line.bbox)).toEqual([
      [75, 410, 330, 450],
      [332, 411, 424, 450],
    ]);
    expect(result.fullText).toBe('token=fake-82K\nlmQp9.');
  });

  it('maps a wrapped sensitive URL to one complete box on each visual line', () => {
    const result = normalizePaddleResult(
      {
        results: [
          {
            text: 'https://account.example.com/recover/vinnie-monaco?',
            box: { x: 65, y: 340, width: 900, height: 41 },
          },
          {
            text: 'token=fake-82KlmQp9.',
            box: { x: 75, y: 410, width: 349, height: 40 },
          },
        ],
      },
      1000,
      700
    );
    const document = buildOCRDocument(result);
    const sensitiveEnd = document.text.lastIndexOf('.');
    const segments = mapDocumentRangeToLines(document, 0, sensitiveEnd, 1000, 700);

    expect(segments).toHaveLength(2);
    expect(segments[0].bbox).toEqual([63, 340, 967, 381]);
    expect(segments[1].bbox).toEqual([73, 410, 424, 450]);
    expect(segments[1].wordIds).toEqual(['paddle_region_1']);
  });

  it('does not synthesize text between nearby OCR regions', () => {
    const result = normalizePaddleResult(
      {
        results: [
          { text: 'May', box: { x: 100, y: 20, width: 45, height: 30 } },
          { text: 'Chen', box: { x: 153, y: 20, width: 60, height: 30 } },
        ],
      },
      400,
      100
    );

    expect(result.lines.map((line) => line.text)).toEqual(['May', 'Chen']);
    expect(result.fullText).toBe('May\nChen');
  });

  it('keeps touching table cells as independent model-input regions', () => {
    const firstEmail = 'hieu.nguyen4@tyme.com';
    const secondEmail = 'hieu.nguyen4@tyme.com';
    const result = normalizePaddleResult(
      {
        results: [
          { text: firstEmail, box: { x: 828, y: 640, width: 280, height: 40 } },
          { text: secondEmail, box: { x: 1108, y: 640, width: 280, height: 40 } },
          { text: 'April 20, 2026', box: { x: 1394, y: 640, width: 150, height: 40 } },
        ],
      },
      1774,
      1000
    );

    expect(result.lines).toHaveLength(3);
    expect(result.lines.map((line) => line.text)).toEqual([
      firstEmail,
      secondEmail,
      'April 20, 2026',
    ]);
    expect(result.fullText).toBe(
      `${firstEmail}\n${secondEmail}\nApril 20, 2026`
    );
  });
});
