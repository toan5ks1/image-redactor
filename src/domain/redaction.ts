import { BBox } from './ocr';
import { DetectorSource, EntityCategory } from './sensitive-entity';

export type RedactionStyle = 'blur' | 'pixelate' | 'mask';

export interface Redaction {
  id: string;
  bbox: BBox;
  /** Unpadded detector/manual geometry, retained for deterministic padding edits. */
  baseBbox: BBox;
  category: EntityCategory;
  style: RedactionStyle;
  source: 'automatic' | 'manual';
  /** Detectors whose matches contributed to this redaction after de-duplication. */
  matchedBy: DetectorSource[];
  enabled: boolean;
  label: string;
  value?: string;
}

export interface RedactionSettings {
  defaultStyle: RedactionStyle;
  padding: number;
  pixelateBlockSize: number;
  blurRadius: number;
  maskColor: string;
}
