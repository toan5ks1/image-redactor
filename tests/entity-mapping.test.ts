import { describe, expect, it } from 'vitest';
import { BBox } from '../src/domain/ocr';
import { SensitiveEntity } from '../src/domain/sensitive-entity';
import { EntityBoxMapper } from '../src/engines/mapping/EntityBoxMapper';

const entity = (id: string, bbox: BBox): SensitiveEntity => ({
  id,
  category: 'email',
  text: 'same@example.com',
  detector: 'rules',
  confidence: 0.98,
  lineId: 'line-1',
  bbox,
});

describe('EntityBoxMapper', () => {
  it('preserves detector-produced boxes for duplicate text occurrences', () => {
    const redactions = EntityBoxMapper.createRedactions(
      [entity('first', [70, 10, 190, 30]), entity('second', [240, 10, 360, 30])],
      { imageWidth: 500, imageHeight: 100, padding: 0 }
    );

    expect(redactions).toHaveLength(2);
    expect(redactions[0].bbox).toEqual([70, 10, 190, 30]);
    expect(redactions[1].bbox).toEqual([240, 10, 360, 30]);
  });

  it('clamps padding to the original image dimensions', () => {
    expect(EntityBoxMapper.applyPadding([2, 3, 498, 99], 10, 500, 100)).toEqual([
      0, 0, 500, 100,
    ]);
  });

  it('defaults secrets to blur', () => {
    const secret: SensitiveEntity = {
      ...entity('secret', [70, 10, 190, 30]),
      category: 'secret',
    };
    const [redaction] = EntityBoxMapper.createRedactions([secret], {
      imageWidth: 500,
      imageHeight: 100,
      padding: 0,
    });

    expect(redaction.style).toBe('blur');
  });

  it('drops invalid detector geometry instead of widening it', () => {
    const invalid = entity('invalid', [50, 10, 50, 30]);
    const redactions = EntityBoxMapper.createRedactions([invalid], {
      imageWidth: 500,
      imageHeight: 100,
      padding: 0,
    });

    expect(redactions).toEqual([]);
  });

  it('drops boxes that become empty after image-bound clamping', () => {
    const outside = entity('outside', [600, 10, 700, 30]);
    const redactions = EntityBoxMapper.createRedactions([outside], {
      imageWidth: 500,
      imageHeight: 100,
      padding: 0,
    });

    expect(redactions).toEqual([]);
  });

  it('keeps the union of duplicate boxes regardless of input order', () => {
    const small = entity('small', [100, 10, 160, 30]);
    const large = entity('large', [90, 8, 180, 32]);
    const options = { imageWidth: 500, imageHeight: 100, padding: 0 };

    expect(EntityBoxMapper.createRedactions([small, large], options)[0].bbox).toEqual([
      90, 8, 180, 32,
    ]);
    expect(EntityBoxMapper.createRedactions([large, small], options)[0].bbox).toEqual([
      90, 8, 180, 32,
    ]);
  });

  it('keeps blur as the default when a secret overlaps another category', () => {
    const email = entity('email', [70, 10, 190, 30]);
    const secret: SensitiveEntity = {
      ...entity('secret', [70, 10, 190, 30]),
      category: 'secret',
      detector: 'privacy-filter',
      confidence: 0.91,
    };

    const [redaction] = EntityBoxMapper.createRedactions([email, secret], {
      imageWidth: 500,
      imageHeight: 100,
      padding: 0,
    });

    expect(redaction.style).toBe('blur');
    expect(redaction.category).toBe('secret');
    expect(redaction.matchedBy).toEqual(['rules', 'privacy-filter']);
  });

  it('preserves the detector source for a single automatic match', () => {
    const [redaction] = EntityBoxMapper.createRedactions(
      [entity('rule-email', [70, 10, 190, 30])],
      { imageWidth: 500, imageHeight: 100, padding: 0 }
    );

    expect(redaction.matchedBy).toEqual(['rules']);
  });

  it('does not widen precise rule geometry with a coarse overlapping AI chunk', () => {
    const rule = entity('rule-secret', [120, 10, 220, 30]);
    rule.category = 'secret';
    rule.text = 'actual-secret';
    const model: SensitiveEntity = {
      ...rule,
      id: 'model-secret',
      detector: 'privacy-filter',
      confidence: 0.999,
      bbox: [80, 8, 280, 32],
      text: 'SECRET_KEY="actual-secret"',
    };

    const [redaction] = EntityBoxMapper.createRedactions([rule, model], {
      imageWidth: 500,
      imageHeight: 100,
      padding: 0,
    });

    expect(redaction.bbox).toEqual([120, 10, 220, 30]);
    expect(redaction.matchedBy).toEqual(['rules', 'privacy-filter']);
  });
});
