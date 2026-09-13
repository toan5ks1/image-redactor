/**
 * Typographical metrics and proportional character weights for OCR text geometry.
 *
 * In proportional fonts (Roboto, Inter, Arial, Helvetica, Times, etc.),
 * characters have vastly different widths. Using uniform linear character division
 * across a line produces 15-40px of drift over 40-60 characters, causing
 * bounding boxes to truncate or leak leading and trailing characters (e.g. '0', 'm', '1').
 */

/**
 * Returns a proportional typographical width weight for a character.
 * Base unit is 1.0 (approximately the width of a standard digit or uppercase character).
 */
export function getCharWeight(char: string): number {
  if (char === ' ' || char === '\t') return 0.5;
  // Very narrow punctuation
  if (/[.,;:!'`|]/.test(char)) return 0.35;
  // Narrow letters, digits and brackets
  if (/[ijlIt1\-\(\)\[\]\{\}]/.test(char)) return 0.45;
  // Semi-narrow letters
  if (/[fr]/.test(char)) return 0.55;
  // Ultra-wide letters and symbols
  if (/[mMwW%@#&]/.test(char)) return 1.35;
  // Standard uppercase & tabular digits
  if (/[A-Z0-9]/.test(char)) return 1.05;
  // Standard lowercase letters
  return 0.85;
}

/**
 * Computes the horizontal coordinate offsets for each character in `text`.
 * Returns an array of size `text.length + 1`, where index `i` is the horizontal
 * pixel coordinate of character `i`'s start (and index `text.length` is the end of the text).
 */
export function computeCharOffsets(
  text: string,
  x0: number,
  x1: number
): number[] {
  const n = text.length;
  if (n === 0) return [x0];
  const width = Math.max(0, x1 - x0);
  if (width === 0) return new Array(n + 1).fill(x0);

  const weights: number[] = new Array(n);
  let totalWeight = 0;
  for (let i = 0; i < n; i++) {
    const w = getCharWeight(text[i]);
    weights[i] = w;
    totalWeight += w;
  }

  if (totalWeight <= 0) totalWeight = n;

  const offsets: number[] = new Array(n + 1);
  offsets[0] = x0;

  let cumulativeWeight = 0;
  for (let i = 0; i < n; i++) {
    cumulativeWeight += weights[i];
    offsets[i + 1] = Math.round(x0 + (cumulativeWeight / totalWeight) * width);
  }

  // Ensure strict monotonicity and boundary clamp
  offsets[n] = x1;
  for (let i = 1; i <= n; i++) {
    if (offsets[i] < offsets[i - 1]) {
      offsets[i] = offsets[i - 1];
    }
  }

  return offsets;
}

/**
 * Calculates horizontal start and end pixel coordinates for a substring span within `text`.
 */
export function computeSubSpanOffsets(
  text: string,
  x0: number,
  x1: number,
  start: number,
  end: number
): [number, number] {
  if (text.length === 0 || start >= end) return [x0, x1];

  const clampedStart = Math.max(0, Math.min(text.length, start));
  const clampedEnd = Math.max(clampedStart, Math.min(text.length, end));

  const offsets = computeCharOffsets(text, x0, x1);
  return [offsets[clampedStart], offsets[clampedEnd]];
}
