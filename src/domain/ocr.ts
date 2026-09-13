/**
 * Bounding Box coordinate convention: [x0, y0, x1, y1]
 * where (x0, y0) is top-left and (x1, y1) is bottom-right.
 */
export type BBox = [number, number, number, number];

export interface OCRWord {
  id: string;
  text: string;
  bbox: BBox;
  confidence?: number;
}

export interface OCRLine {
  id: string;
  text: string;
  bbox: BBox;
  confidence?: number;
  words: OCRWord[];
}

export interface OCRResult {
  imageWidth: number;
  imageHeight: number;
  lines: OCRLine[];
  fullText: string;
}
