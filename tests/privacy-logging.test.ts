import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : ['.ts', '.tsx'].includes(extname(entry.name))
        ? [path]
        : [];
  });
}

describe('privacy logging policy', () => {
  it('does not write OCR text, images, or secrets to the browser console', () => {
    const offenders = sourceFiles(join(process.cwd(), 'src')).filter((path) =>
      /console\.(?:log|info|warn|error|debug)\s*\(/.test(readFileSync(path, 'utf8'))
    );

    expect(offenders).toEqual([]);
  });
});
