import { describe, expect, it } from 'vitest';
import { OCRLine } from '../src/domain/ocr';
import { OCRBoundingBoxCalculator } from '../src/engines/mapping/OCRBoundingBoxCalculator';

describe('OCRBoundingBoxCalculator', () => {
  it('does not truncate wide trailing characters when followed by light punctuation', () => {
    // In "john.smith@example.com.", the word ends with a period.
    // The letter 'm' is wide. The period is narrow.
    const line: OCRLine = {
      id: 'line-1',
      text: 'john.smith@example.com. He works at Acme',
      bbox: [100, 50, 800, 85],
      words: [
        { id: 'w1', text: 'john.smith@example.com.', bbox: [100, 50, 480, 85] },
        { id: 'w2', text: 'He', bbox: [495, 50, 520, 85] },
        { id: 'w3', text: 'works', bbox: [530, 50, 600, 85] },
        { id: 'w4', text: 'at', bbox: [610, 50, 640, 85] },
        { id: 'w5', text: 'Acme', bbox: [650, 50, 720, 85] },
      ],
    };

    // Match is strictly "john.smith@example.com" (indices 0 to 22, excluding period at index 22)
    const matchStart = 0;
    const matchEnd = 'john.smith@example.com'.length;

    const bbox = OCRBoundingBoxCalculator.calculateSpanBbox(line, matchStart, matchEnd);

    // subX1 must stay close to 480 (at least 476), NOT getting pulled back to 455
    expect(bbox[0]).toBeLessThanOrEqual(100);
    expect(bbox[2]).toBeGreaterThanOrEqual(476);
  });

  it('keeps key unmasked while fully covering the value in glued key-value pairs', () => {
    const line: OCRLine = {
      id: 'line-2',
      text: 'customer_name="Mira Kovalenko"',
      bbox: [100, 50, 600, 85],
      words: [
        { id: 'w1', text: 'customer_name="Mira', bbox: [100, 50, 400, 85] },
        { id: 'w2', text: 'Kovalenko"', bbox: [410, 50, 580, 85] },
      ],
    };

    // Match is "Mira Kovalenko" (indices 15 to 29)
    const matchStart = 15;
    const matchEnd = 29;

    const bbox = OCRBoundingBoxCalculator.calculateSpanBbox(line, matchStart, matchEnd);

    // Must NOT start at 100 (which is customer_name=); should start around 330
    expect(bbox[0]).toBeGreaterThanOrEqual(300);
    // Must cover Kovalenko
    expect(bbox[2]).toBeGreaterThanOrEqual(570);
  });

  it('covers full standalone words with defensive padding', () => {
    const line: OCRLine = {
      id: 'line-3',
      text: 'His account number is 1234567890 at Example Bank',
      bbox: [100, 50, 900, 85],
      words: [
        { id: 'w1', text: 'His', bbox: [100, 50, 140, 85] },
        { id: 'w2', text: 'account', bbox: [150, 50, 240, 85] },
        { id: 'w3', text: 'number', bbox: [250, 50, 330, 85] },
        { id: 'w4', text: 'is', bbox: [340, 50, 360, 85] },
        { id: 'w5', text: '1234567890', bbox: [375, 50, 550, 85] },
        { id: 'w6', text: 'at', bbox: [565, 50, 590, 85] },
      ],
    };

    const matchStart = line.text.indexOf('1234567890');
    const matchEnd = matchStart + '1234567890'.length;

    const bbox = OCRBoundingBoxCalculator.calculateSpanBbox(line, matchStart, matchEnd);

    // Full word bbox [375, 50, 550, 85] with defensive padding
    expect(bbox[0]).toBeLessThanOrEqual(375);
    expect(bbox[2]).toBeGreaterThanOrEqual(550);
  });

  it('does not expand an exact match across large table-column gaps', () => {
    const line: OCRLine = {
      id: 'table-row',
      text: 'external-id 014554068909 2026-01-22',
      bbox: [100, 50, 980, 80],
      words: [
        { id: 'external', text: 'external-id', bbox: [100, 50, 210, 80] },
        { id: 'account', text: '014554068909', bbox: [500, 50, 620, 80] },
        { id: 'date', text: '2026-01-22', bbox: [850, 50, 950, 80] },
      ],
    };
    const start = line.text.indexOf('014554068909');
    const bbox = OCRBoundingBoxCalculator.calculateSpanBbox(
      line,
      start,
      start + '014554068909'.length
    );

    expect(bbox).toEqual([498, 50, 622, 80]);
  });
});
