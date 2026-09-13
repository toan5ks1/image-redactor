import { OCRResult } from '../../domain/ocr';
import { SensitiveEntity, EntityCategory } from '../../domain/sensitive-entity';
import { OCRBoundingBoxCalculator } from '../mapping/OCRBoundingBoxCalculator';
import { PrivacyDetector, PrivacyDetectorProgress } from './PrivacyDetector';

interface RulePattern {
  category: EntityCategory;
  regex: RegExp;
  confidence: number;
}

const RULES: readonly RulePattern[] = [
  // OpenAI API Keys
  {
    category: 'secret',
    regex: /sk-(?:proj-|svcacct-)?[a-zA-Z0-9_-]{20,}/g,
    confidence: 0.99,
  },
  // GitHub Tokens
  {
    category: 'secret',
    regex: /gh[pousr]_[a-zA-Z0-9]{36,}/g,
    confidence: 0.99,
  },
  // AWS Access Key
  {
    category: 'secret',
    regex: /AKIA[0-9A-Z]{16}/g,
    confidence: 0.99,
  },
  // Slack Tokens
  {
    category: 'secret',
    regex: /xox[baprs]-[0-9a-zA-Z-]{10,}/g,
    confidence: 0.98,
  },
  // Stripe API Key
  {
    category: 'secret',
    regex: /(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{20,}/g,
    confidence: 0.99,
  },
  // JWT Tokens
  {
    category: 'secret',
    regex: /ey[A-Za-z0-9_-]{10,}\.ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_+/=-]*/g,
    confidence: 0.98,
  },
  // Private Key Header
  {
    category: 'secret',
    regex: /-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----/g,
    confidence: 1.0,
  },
  // Generic Key/Token key-value pairs
  {
    category: 'secret',
    regex:
      /(?:api[_-]?key|access[_-]?token|client[_-]?secret|auth[_-]?token)\s*[:=]\s*["']?([a-zA-Z0-9_.+=/-]{12,})["']?/gi,
    confidence: 0.95,
  },
  // Password values in key-values
  {
    category: 'password',
    regex: /(?:password|passwd|pwd)\s*[:=]\s*["']?([^\s"'`]{6,})["']?/gi,
    confidence: 0.95,
  },
  // Bearer authorization
  {
    category: 'secret',
    regex: /Bearer\s+([a-zA-Z0-9_.+=/-]{16,})/gi,
    confidence: 0.97,
  },
  // Email addresses
  {
    category: 'email',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    confidence: 0.98,
  },
  // Phone numbers (International and US/VN formats)
  {
    category: 'phone',
    regex:
      /(?<![\w-])(?<!\d{4}[-.\s])(?:\+\d{1,3}\s*)?(?:\(\d{2,4}\)|\d{2,4})[-.\s]\d{3,4}[-.\s]\d{3,4}(?![-.\s]\d{3,4}\b)(?![\w-])/g,
    confidence: 0.9,
  },
  // Credit card patterns
  {
    category: 'account',
    regex: /\b(?:\d{4}[- ]){3}\d{4}\b|\b\d{16}\b/g,
    confidence: 0.92,
  },
];

export class RulesDetector implements PrivacyDetector {
  name = 'Deterministic Security Rules';

  async detect(
    ocrResult: OCRResult,
    onProgress?: (progress: PrivacyDetectorProgress) => void,
    signal?: AbortSignal,
  ): Promise<SensitiveEntity[]> {
    onProgress?.({
      status: 'Running deterministic security rules…',
      progress: 10,
    });
    const entities: SensitiveEntity[] = [];
    let idCounter = 1;

    for (const line of ocrResult.lines) {
      signal?.throwIfAborted();
      const text = line.text;
      if (!text) continue;

      for (const rule of RULES) {
        // Reset regex state
        rule.regex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = rule.regex.exec(text)) !== null) {
          const matchedText = match[1] || match[0];
          const matchStart =
            match.index + (match[1] ? match[0].indexOf(match[1]) : 0);
          const matchEnd = matchStart + matchedText.length;
          const bbox = OCRBoundingBoxCalculator.calculateSpanBbox(
            line,
            matchStart,
            matchEnd,
          );

          entities.push({
            id: `${line.id}_rule_${idCounter++}`,
            category: rule.category,
            text: matchedText,
            confidence: rule.confidence,
            detector: 'rules',
            bbox,
            lineId: line.id,
            start: matchStart,
            end: matchEnd,
          });
        }
      }
    }

    onProgress?.({ status: 'Deterministic rules finished', progress: 100 });
    return entities;
  }
}
