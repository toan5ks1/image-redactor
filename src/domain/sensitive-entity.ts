import { BBox } from './ocr';

export type EntityCategory =
  | 'secret'
  | 'email'
  | 'phone'
  | 'person'
  | 'address'
  | 'account'
  | 'date'
  | 'url'
  | 'password'
  | 'custom';

export type DetectorSource = 'privacy-filter' | 'rules' | 'manual';

export interface SensitiveEntity {
  id: string;
  category: EntityCategory;
  text: string;
  confidence?: number;
  detector: DetectorSource;
  /** Image coordinates calculated directly from the referenced OCR words. */
  bbox: BBox;
  lineId?: string;
  /** Optional source character range, retained for review/debugging only. */
  start?: number;
  end?: number;
  wordIds?: string[];
}
