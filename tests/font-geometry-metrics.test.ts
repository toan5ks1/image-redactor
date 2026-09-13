import { describe, expect, it } from 'vitest';
import {
  getCharWeight,
  computeCharOffsets,
  computeSubSpanOffsets,
} from '../src/engines/mapping/FontGeometryMetrics';

describe('FontGeometryMetrics', () => {
  describe('getCharWeight', () => {
    it('assigns lower weight to narrow punctuation than to digits', () => {
      expect(getCharWeight('.')).toBeLessThan(getCharWeight('0'));
      expect(getCharWeight(',')).toBeLessThan(getCharWeight('5'));
      expect(getCharWeight('!')).toBeLessThan(getCharWeight('A'));
    });

    it('assigns higher weight to wide characters', () => {
      expect(getCharWeight('m')).toBeGreaterThan(getCharWeight('i'));
      expect(getCharWeight('W')).toBeGreaterThan(getCharWeight('l'));
      expect(getCharWeight('@')).toBeGreaterThan(getCharWeight('r'));
    });

    it('assigns less weight to spaces than digits', () => {
      expect(getCharWeight(' ')).toBeLessThan(getCharWeight('0'));
    });
  });

  describe('computeCharOffsets', () => {
    it('returns array of length text.length + 1', () => {
      const offsets = computeCharOffsets('hello', 0, 100);
      expect(offsets).toHaveLength(6);
    });

    it('starts at x0 and ends at x1', () => {
      const offsets = computeCharOffsets('abc', 50, 200);
      expect(offsets[0]).toBe(50);
      expect(offsets[3]).toBe(200);
    });

    it('is strictly monotonically non-decreasing', () => {
      const text = '45,000,000 VND. His national ID number is 079095012345,';
      const offsets = computeCharOffsets(text, 10, 860);
      for (let i = 1; i < offsets.length; i++) {
        expect(offsets[i]).toBeGreaterThanOrEqual(offsets[i - 1]);
      }
    });

    it('places narrow punctuation closer together than wide characters', () => {
      // "m,m" – the span of "m" should be wider than that of ","
      const offsets = computeCharOffsets('m,m', 0, 300);
      const mWidth = offsets[1] - offsets[0];   // first 'm'
      const commaWidth = offsets[2] - offsets[1]; // ','
      expect(mWidth).toBeGreaterThan(commaWidth);
    });
  });

  describe('computeSubSpanOffsets', () => {
    it('returns [x0, x1] for full span', () => {
      const [s, e] = computeSubSpanOffsets('hello', 0, 100, 0, 5);
      expect(s).toBe(0);
      expect(e).toBe(100);
    });

    it('proportionally reduces x1 to cover only prefix chars', () => {
      // Only 'abc' of 'abcXXX' – should end before midpoint
      const [, e] = computeSubSpanOffsets('abcXXX', 0, 600, 0, 3);
      expect(e).toBeGreaterThan(0);
      expect(e).toBeLessThan(600);
    });

    it('corrects proportional drift for national ID in a long line', () => {
      const text = '45,000,000 VND. His national ID number is 079095012345,';
      const lineX0 = 45;
      const lineX1 = 905;
      const idx = text.indexOf('079095012345');

      const [proportional] = computeSubSpanOffsets(text, lineX0, lineX1, idx, idx + 12);
      const linear = lineX0 + (idx / text.length) * (lineX1 - lineX0);

      // Proportional should be left of linear (narrow comma chars before ID compress the estimate)
      expect(proportional).toBeLessThan(linear);
    });

    it('handles empty text gracefully', () => {
      const [s, e] = computeSubSpanOffsets('', 10, 200, 0, 0);
      expect(s).toBe(10);
      expect(e).toBe(200);
    });
  });
});
