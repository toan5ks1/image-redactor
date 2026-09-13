import { describe, expect, it } from 'vitest';
import {
  MAX_IMAGE_FILE_SIZE,
  validateImageDimensions,
  validateImageFile,
} from '../src/shared/utils/image';

describe('validateImageFile', () => {
  it('accepts a PNG by its file signature', async () => {
    const png = new Blob([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
    ]);

    await expect(validateImageFile(png)).resolves.toBeUndefined();
  });

  it('accepts a JPEG by its file signature', async () => {
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])]);

    await expect(validateImageFile(jpeg)).resolves.toBeUndefined();
  });

  it('rejects unsupported or spoofed image content', async () => {
    const unsupported = new Blob(['not an image'], { type: 'image/png' });

    await expect(validateImageFile(unsupported)).rejects.toThrow('Unsupported image format');
  });

  it('rejects files above the 20 MB limit before reading content', async () => {
    const oversized = { size: MAX_IMAGE_FILE_SIZE + 1 } as Blob;

    await expect(validateImageFile(oversized)).rejects.toThrow('larger than the 20 MB limit');
  });

  it('rejects dimensions above 10,000 pixels', () => {
    expect(() => validateImageDimensions(10_001, 800)).toThrow('maximum is 10,000 × 10,000px');
    expect(() => validateImageDimensions(800, 10_001)).toThrow('maximum is 10,000 × 10,000px');
  });
});
