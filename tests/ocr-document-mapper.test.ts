import { describe, expect, it } from 'vitest';
import { OCRResult } from '../src/domain/ocr';
import {
  buildOCRDocument,
  mapDocumentRangeToLines,
} from '../src/engines/mapping/OCRDocumentMapper';

const ocrResult: OCRResult = {
  imageWidth: 500,
  imageHeight: 120,
  fullText: 'Customer details\nMira Kovalenko lives here',
  lines: [
    {
      id: 'line-1',
      text: 'Customer details',
      bbox: [20, 10, 220, 30],
      words: [{ id: 'word-1', text: 'Customer details', bbox: [20, 10, 220, 30] }],
    },
    {
      id: 'line-2',
      text: 'Mira Kovalenko lives here',
      bbox: [20, 45, 360, 70],
      words: [{ id: 'word-2', text: 'Mira Kovalenko lives here', bbox: [20, 45, 360, 70] }],
    },
  ],
};

describe('OCRDocumentMapper', () => {
  it('builds one contextual model input with stable line offsets', () => {
    const document = buildOCRDocument(ocrResult);

    expect(document.text).toBe('Customer details\nMira Kovalenko lives here');
    expect(document.lines.map(({ start, end }) => [start, end])).toEqual([
      [0, 16],
      [17, 42],
    ]);
  });

  it('splits a multi-line model range into separate image boxes', () => {
    const document = buildOCRDocument(ocrResult);
    const start = document.text.indexOf('details');
    const end = document.text.indexOf('lives');
    const segments = mapDocumentRangeToLines(document, start, end, 500, 120);

    expect(segments).toHaveLength(2);
    expect(segments.map((segment) => segment.line.id)).toEqual(['line-1', 'line-2']);
    expect(segments[0].bbox[1]).toBe(10);
    expect(segments[1].bbox[1]).toBe(45);
    expect(segments.every((segment) => segment.bbox[2] > segment.bbox[0])).toBe(true);
  });
});
