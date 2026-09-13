import { BBox, OCRLine } from '../../domain/ocr';
import { computeSubSpanOffsets } from './FontGeometryMetrics';

/**
 * Calculates robust, pixel-accurate bounding boxes for sensitive text spans within OCR lines.
 *
 * Designed to prevent:
 * 1. Prefix/suffix glyph truncation (e.g. wide characters like 'm', '0', 'W' getting clipped)
 * 2. Key-value label obscuration (e.g. `customer_name="` being covered by the value mask)
 * 3. Character drift across proportional fonts using typographical metrics
 * 4. Antialiasing pixel leakage with a small, bounded safety margin
 */
export class OCRBoundingBoxCalculator {
  static calculateSpanBbox(
    line: OCRLine,
    matchStart: number,
    matchEnd: number,
    imageWidth?: number,
    imageHeight?: number
  ): BBox {
    // Fallback if word-level geometry is unavailable
    if (!line.words || line.words.length === 0) {
      const [x0, x1] = computeSubSpanOffsets(
        line.text,
        line.bbox[0],
        line.bbox[2],
        matchStart,
        matchEnd
      );
      return this.finalizeBbox(
        [Math.round(x0), line.bbox[1], Math.round(x1), line.bbox[3]],
        imageWidth,
        imageHeight
      );
    }

    let currentIndex = 0;
    const allWordSpans: Array<{
      word: (typeof line.words)[0];
      wordStart: number;
      wordEnd: number;
    }> = [];

    for (let wIdx = 0; wIdx < line.words.length; wIdx++) {
      const word = line.words[wIdx];
      const wordStart = line.text.indexOf(word.text, currentIndex);
      if (wordStart < 0) continue;
      const wordEnd = wordStart + word.text.length;
      currentIndex = wordEnd;
      allWordSpans.push({ word, wordStart, wordEnd });
    }

    const matchedSpans = allWordSpans.filter(
      (span) => span.wordEnd > matchStart && span.wordStart < matchEnd
    );

    if (matchedSpans.length === 0) {
      const [x0, x1] = computeSubSpanOffsets(
        line.text,
        line.bbox[0],
        line.bbox[2],
        matchStart,
        matchEnd
      );
      return this.finalizeBbox(
        [Math.round(x0), line.bbox[1], Math.round(x1), line.bbox[3]],
        imageWidth,
        imageHeight
      );
    }

    const matchedBboxes: BBox[] = [];
    for (const span of matchedSpans) {
      const { word, wordStart, wordEnd } = span;

      let subX0 = word.bbox[0];
      let subX1 = word.bbox[2];

      // Sub-word leading boundary (e.g. `customer_name="Mira` or `order_id=ORD`)
      if (wordStart < matchStart) {
        const prefixChars = matchStart - wordStart;
        const [charSubX0] = computeSubSpanOffsets(
          word.text,
          word.bbox[0],
          word.bbox[2],
          prefixChars,
          word.text.length
        );
        // Exclude key prefix, but give 2px defensive overlap so the first sensitive character is never clipped
        subX0 = Math.max(word.bbox[0], charSubX0 - 2);
      }

      // Sub-word trailing boundary (e.g. `john.smith@example.com.` or `079095012345,`)
      if (wordEnd > matchEnd) {
        const suffixChars = wordEnd - matchEnd;
        const suffixText = word.text.slice(word.text.length - suffixChars);
        const isLightPunctuation = /^[.,;:!?'")\]}\s]+$/.test(suffixText);

        if (isLightPunctuation) {
          // Keep nearly the whole word box minus a small offset for punctuation
          const punctSafetyOffset = suffixText.includes('"') || suffixText.includes("'") ? 4 : 2;
          subX1 = Math.max(subX0 + 4, word.bbox[2] - punctSafetyOffset);
        } else {
          const validChars = matchEnd - wordStart;
          const [, charSubX1] = computeSubSpanOffsets(
            word.text,
            word.bbox[0],
            word.bbox[2],
            0,
            validChars
          );
          subX1 = Math.min(word.bbox[2], charSubX1 + 2);
        }
      }

      matchedBboxes.push([subX0, word.bbox[1], subX1, word.bbox[3]]);
    }

    const rawBox: BBox = [
      Math.min(...matchedBboxes.map((b) => b[0])),
      Math.min(...matchedBboxes.map((b) => b[1])),
      Math.max(...matchedBboxes.map((b) => b[2])),
      Math.max(...matchedBboxes.map((b) => b[3])),
    ];

    return this.finalizeBbox(rawBox, imageWidth, imageHeight);
  }

  private static finalizeBbox(
    box: BBox,
    imageWidth?: number,
    imageHeight?: number
  ): BBox {
    // 2px horizontal safety margin absorbs antialiasing font bleeding
    const x0 = Math.max(0, box[0] - 2);
    const y0 = Math.max(0, box[1]);
    const x1 = imageWidth !== undefined ? Math.min(imageWidth, box[2] + 2) : box[2] + 2;
    const y1 = imageHeight !== undefined ? Math.min(imageHeight, box[3]) : box[3];

    return [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)];
  }
}
