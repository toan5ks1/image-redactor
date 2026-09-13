import { Redaction } from '../../domain/redaction';
import { RedactionRenderer, RenderOptions } from '../canvas/RedactionRenderer';

export class ImageExporter {
  static async exportRedactedImage(
    originalImage: HTMLImageElement | HTMLCanvasElement,
    redactions: Redaction[],
    options: Omit<RenderOptions, 'interactiveOverlay' | 'selectedId' | 'hoveredId'> = {}
  ): Promise<Blob> {
    const width =
      originalImage instanceof HTMLImageElement
        ? originalImage.naturalWidth || originalImage.width
        : originalImage.width;
    const height =
      originalImage instanceof HTMLImageElement
        ? originalImage.naturalHeight || originalImage.height
        : originalImage.height;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D canvas context for export.');
    }

    // Render strictly without editor overlays
    RedactionRenderer.drawRedactedImage(ctx, originalImage, redactions, {
      ...options,
      interactiveOverlay: false,
    });

    return new Promise<Blob>((resolve, reject) => {
      exportCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to generate PNG blob from canvas.'));
          }
        },
        'image/png',
        1.0
      );
    });
  }

  static downloadBlob(blob: Blob, filename = 'redacted-screenshot.png'): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  static async copyToClipboard(blob: Blob): Promise<boolean> {
    try {
      if (typeof navigator.clipboard?.write === 'function') {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
