import { DetectorSource, SensitiveEntity } from '../../domain/sensitive-entity';
import { Redaction, RedactionStyle } from '../../domain/redaction';
import { BBox } from '../../domain/ocr';

export interface MappingOptions {
  padding?: number;
  imageWidth: number;
  imageHeight: number;
  defaultStyle?: RedactionStyle;
}

type MappedSensitiveEntity = SensitiveEntity & { matchedBy: DetectorSource[] };

export class EntityBoxMapper {
  static createRedactions(
    entities: SensitiveEntity[],
    options: MappingOptions
  ): Redaction[] {
    const { padding = 4, imageWidth, imageHeight } = options;
    const validEntities = entities
      .map((entity) => ({
        ...entity,
        bbox: this.clampBbox(entity.bbox, imageWidth, imageHeight),
        matchedBy: [entity.detector],
      }))
      .filter((entity) => entity.bbox[2] > entity.bbox[0] && entity.bbox[3] > entity.bbox[1]);

    // Sort by position (y then x)
    validEntities.sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);

    // De-duplicate heavily overlapping boxes (IoU / subset)
    const deduped: MappedSensitiveEntity[] = [];
    for (const entity of validEntities) {
      const duplicateIndex = deduped.findIndex((existing) =>
        this.isOverlapping(entity.bbox, existing.bbox)
      );

      if (duplicateIndex < 0) {
        deduped.push(entity);
      } else {
        deduped[duplicateIndex] = this.mergeDuplicates(deduped[duplicateIndex], entity);
      }
    }

    // Convert to Redaction objects
    return deduped.map((entity, idx) => {
      const defaultStyle: RedactionStyle = options.defaultStyle ?? 'blur';

      const baseBbox = this.clampBbox(entity.bbox, imageWidth, imageHeight);
      const paddedBox = this.applyPadding(baseBbox, padding, imageWidth, imageHeight);

      return {
        id: `redaction_${idx + 1}_${entity.id}`,
        bbox: paddedBox,
        baseBbox,
        category: entity.category,
        style: defaultStyle,
        source: 'automatic',
        matchedBy: entity.matchedBy,
        enabled: true,
        label: entity.text || entity.category,
        value: entity.text,
      };
    });
  }

  private static isOverlapping(boxA: BBox, boxB: BBox): boolean {
    const xOverlap = Math.max(0, Math.min(boxA[2], boxB[2]) - Math.max(boxA[0], boxB[0]));
    const yOverlap = Math.max(0, Math.min(boxA[3], boxB[3]) - Math.max(boxA[1], boxB[1]));
    const overlapArea = xOverlap * yOverlap;

    const areaA = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]);
    const areaB = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]);
    const minArea = Math.min(areaA, areaB);

    // If one box is > 70% contained in the other, consider it duplicate
    return minArea > 0 && overlapArea / minArea > 0.7;
  }

  private static mergeDuplicates(
    existing: MappedSensitiveEntity,
    candidate: MappedSensitiveEntity
  ): MappedSensitiveEntity {
    const existingRisk = this.categoryRisk(existing.category);
    const candidateRisk = this.categoryRisk(candidate.category);
    const preferred =
      candidateRisk > existingRisk ||
      (candidateRisk === existingRisk && (candidate.confidence ?? 0) > (existing.confidence ?? 0))
        ? candidate
        : existing;

    const differentDetectors = existing.detector !== candidate.detector;
    const preciseRuleGeometry =
      existing.detector === 'rules'
        ? existing.bbox
        : candidate.detector === 'rules'
          ? candidate.bbox
          : null;

    return {
      ...preferred,
      matchedBy: this.orderDetectorSources([...existing.matchedBy, ...candidate.matchedBy]),
      // Rules point at an exact regex span. Do not let a coarse AI chunk widen
      // that geometry to include the field name or neighboring log text.
      bbox:
        differentDetectors && preciseRuleGeometry
          ? preciseRuleGeometry
          : [
              Math.min(existing.bbox[0], candidate.bbox[0]),
              Math.min(existing.bbox[1], candidate.bbox[1]),
              Math.max(existing.bbox[2], candidate.bbox[2]),
              Math.max(existing.bbox[3], candidate.bbox[3]),
            ],
    };
  }

  private static orderDetectorSources(sources: DetectorSource[]): DetectorSource[] {
    const sourceSet = new Set(sources);
    return (['rules', 'privacy-filter', 'manual'] as DetectorSource[]).filter((source) =>
      sourceSet.has(source)
    );
  }

  private static categoryRisk(category: SensitiveEntity['category']): number {
    if (category === 'secret' || category === 'password') return 2;
    return 1;
  }

  static applyPadding(
    bbox: BBox,
    padding: number,
    imageWidth: number,
    imageHeight: number
  ): BBox {
    return [
      Math.max(0, bbox[0] - padding),
      Math.max(0, bbox[1] - padding),
      Math.min(imageWidth, bbox[2] + padding),
      Math.min(imageHeight, bbox[3] + padding),
    ];
  }

  static clampBbox(bbox: BBox, imageWidth: number, imageHeight: number): BBox {
    return [
      Math.max(0, Math.min(imageWidth, bbox[0])),
      Math.max(0, Math.min(imageHeight, bbox[1])),
      Math.max(0, Math.min(imageWidth, bbox[2])),
      Math.max(0, Math.min(imageHeight, bbox[3])),
    ];
  }
}
