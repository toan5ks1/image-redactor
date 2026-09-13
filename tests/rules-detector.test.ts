import { describe, expect, it } from 'vitest';
import { OCRResult } from '../src/domain/ocr';
import { RulesDetector } from '../src/engines/privacy/RulesDetector';

describe('RulesDetector', () => {
  it('returns stable line references and distinct spans for repeated entities', async () => {
    const text = 'same@example.com then same@example.com';
    const ocrResult: OCRResult = {
      imageWidth: 400,
      imageHeight: 50,
      fullText: text,
      lines: [{ id: 'line-7', text, bbox: [0, 0, 400, 30], words: [] }],
    };

    const entities = await new RulesDetector().detect(ocrResult);
    const emails = entities.filter((item) => item.category === 'email');

    expect(emails).toHaveLength(2);
    expect(emails.map((item) => item.lineId)).toEqual(['line-7', 'line-7']);
    expect(emails.map((item) => item.start)).toEqual([0, 22]);
    expect(emails.map((item) => item.end)).toEqual([16, 38]);
    expect(emails[0].id).not.toBe(emails[1].id);
  });

  it('honors cancellation without returning partial detections', async () => {
    const controller = new AbortController();
    controller.abort();
    const ocrResult: OCRResult = {
      imageWidth: 100,
      imageHeight: 30,
      fullText: 'person@example.com',
      lines: [
        { id: 'line-1', text: 'person@example.com', bbox: [0, 0, 100, 20], words: [] },
      ],
    };

    await expect(new RulesDetector().detect(ocrResult, undefined, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('does not treat a suffix inside a long transaction ID as a phone number', async () => {
    const transactionId = '2604162359550181460739';
    const ocrResult: OCRResult = {
      imageWidth: 300,
      imageHeight: 30,
      fullText: transactionId,
      lines: [{ id: 'line-id', text: transactionId, bbox: [0, 0, 300, 20], words: [] }],
    };

    const entities = await new RulesDetector().detect(ocrResult);

    expect(entities.filter((item) => item.category === 'phone')).toEqual([]);
  });

  it('does not treat numeric UUID fragments as phone numbers', async () => {
    const text = 'bfcb-3528275887ff d6293331-0296-4c70';
    const ocrResult: OCRResult = {
      imageWidth: 500,
      imageHeight: 30,
      fullText: text,
      lines: [{ id: 'line-uuid', text, bbox: [0, 0, 500, 20], words: [] }],
    };

    const entities = await new RulesDetector().detect(ocrResult);

    expect(entities.filter((item) => item.category === 'phone')).toEqual([]);
  });

  it('continues to detect standalone phone numbers', async () => {
    const phone = '+1 (415) 555-0198';
    const ocrResult: OCRResult = {
      imageWidth: 300,
      imageHeight: 30,
      fullText: phone,
      lines: [{ id: 'line-phone', text: phone, bbox: [0, 0, 300, 20], words: [] }],
    };

    const entities = await new RulesDetector().detect(ocrResult);

    expect(entities.some((item) => item.category === 'phone')).toBe(true);
  });

  it('detects a phone when OCR removes the space before the area code', async () => {
    const phone = '+1(415) 555-0198';
    const ocrResult: OCRResult = {
      imageWidth: 300,
      imageHeight: 30,
      fullText: phone,
      lines: [{ id: 'line-phone', text: phone, bbox: [0, 0, 300, 20], words: [] }],
    };

    const entities = await new RulesDetector().detect(ocrResult);

    expect(entities.filter((item) => item.category === 'phone').map((item) => item.text)).toEqual([
      phone,
    ]);
  });

  it('does not classify the first three groups of a credit card as a phone', async () => {
    const text = 'card_number: "4532 8821 9912 3456"';
    const ocrResult: OCRResult = {
      imageWidth: 500,
      imageHeight: 40,
      fullText: text,
      lines: [{ id: 'line-card', text, bbox: [0, 0, 500, 30], words: [] }],
    };

    const entities = await new RulesDetector().detect(ocrResult);

    expect(entities.filter((item) => item.category === 'phone')).toEqual([]);
    expect(entities.filter((item) => item.category === 'account')).toHaveLength(1);
  });
});
