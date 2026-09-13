import { BBox, OCRLine, OCRResult } from '../../domain/ocr';

interface PaddleBox {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface PaddleRegion {
  text?: unknown;
  confidence?: number;
  box?: PaddleBox;
}

interface PaddleResultLike {
  results?: PaddleRegion[];
  lines?: PaddleRegion[][];
}

/** Converts the OCR library's transport shape into the app's geometry model. */
export function normalizePaddleResult(
  rawResult: PaddleResultLike,
  imageWidth: number,
  imageHeight: number
): OCRResult {
  const rawRegions = Array.isArray(rawResult.results)
    ? rawResult.results
    : (rawResult.lines || []).flat();
  const lines: OCRLine[] = [];

  for (const [index, item] of rawRegions.entries()) {
    const text = String(item?.text || '').trim();
    if (!text) continue;

    const box = item.box || {};
    const x = finiteOrZero(box.x);
    const y = finiteOrZero(box.y);
    const width = Math.max(0, finiteOrZero(box.width));
    const height = Math.max(0, finiteOrZero(box.height));
    if (width === 0 || height === 0) continue;

    const bbox: BBox = [
      Math.round(x),
      Math.round(y),
      Math.round(x + width),
      Math.round(y + height),
    ];
    const id = `paddle_region_${index}`;
    lines.push({
      id,
      text,
      bbox,
      confidence: item.confidence,
      words: [{ id, text, bbox, confidence: item.confidence }],
    });
  }

  return {
    imageWidth,
    imageHeight,
    lines,
    fullText: lines.map((line) => line.text).join('\n'),
  };
}

function finiteOrZero(value?: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
