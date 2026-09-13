import { BBox, OCRLine, OCRResult, OCRWord } from '../../domain/ocr';
import { OCRBoundingBoxCalculator } from './OCRBoundingBoxCalculator';

export interface OCRDocumentLine {
  line: OCRLine;
  start: number;
  end: number;
}

export interface OCRDocument {
  text: string;
  lines: OCRDocumentLine[];
}

export interface OCRLineSegment {
  line: OCRLine;
  start: number;
  end: number;
  bbox: BBox;
  wordIds: string[];
}

/**
 * Builds the exact text sent to the privacy model and retains a stable mapping
 * from its document-level character offsets back to each OCR line.
 */
export function buildOCRDocument(ocrResult: OCRResult): OCRDocument {
  const parts: string[] = [];
  const lines: OCRDocumentLine[] = [];
  let cursor = 0;

  for (const line of ocrResult.lines) {
    if (!line.text) continue;
    if (parts.length > 0) {
      parts.push('\n');
      cursor += 1;
    }

    const start = cursor;
    parts.push(line.text);
    cursor += line.text.length;
    lines.push({ line, start, end: cursor });
  }

  return { text: parts.join(''), lines };
}

/** Maps one model entity range to one or more line-local image boxes. */
export function mapDocumentRangeToLines(
  document: OCRDocument,
  rangeStart: number,
  rangeEnd: number,
  imageWidth?: number,
  imageHeight?: number
): OCRLineSegment[] {
  const start = Math.max(0, Math.min(document.text.length, rangeStart));
  const end = Math.max(start, Math.min(document.text.length, rangeEnd));
  if (start === end) return [];

  const segments: OCRLineSegment[] = [];
  for (const item of document.lines) {
    const overlapStart = Math.max(start, item.start);
    const overlapEnd = Math.min(end, item.end);
    if (overlapStart >= overlapEnd) continue;

    const localStart = overlapStart - item.start;
    const localEnd = overlapEnd - item.start;
    const wordIds = matchingWords(item.line, localStart, localEnd).map((word) => word.id);
    segments.push({
      line: item.line,
      start: localStart,
      end: localEnd,
      bbox: OCRBoundingBoxCalculator.calculateSpanBbox(
        item.line,
        localStart,
        localEnd,
        imageWidth,
        imageHeight
      ),
      wordIds,
    });
  }

  return segments;
}

function matchingWords(line: OCRLine, matchStart: number, matchEnd: number): OCRWord[] {
  const matches: OCRWord[] = [];
  let cursor = 0;

  for (const word of line.words || []) {
    const wordStart = line.text.indexOf(word.text, cursor);
    if (wordStart < 0) continue;
    const wordEnd = wordStart + word.text.length;
    cursor = wordEnd;
    if (wordEnd > matchStart && wordStart < matchEnd) matches.push(word);
  }

  return matches;
}
