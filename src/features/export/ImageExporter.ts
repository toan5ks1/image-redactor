import { Redaction } from '../../domain/redaction';
import { RedactionRenderer, RenderOptions } from '../canvas/RedactionRenderer';

export const IMAGE_EXPORT_FORMATS = {
  png: {
    label: 'PNG',
    extension: 'png',
    mimeType: 'image/png',
    quality: 1,
  },
  jpeg: {
    label: 'JPEG',
    extension: 'jpg',
    mimeType: 'image/jpeg',
    quality: 0.92,
  },
} as const;

export type ImageExportFormatId = keyof typeof IMAGE_EXPORT_FORMATS;
export type ImageExportFormat = (typeof IMAGE_EXPORT_FORMATS)[ImageExportFormatId];

export class ImageExporter {
  static async exportRedactedImage(
    originalImage: HTMLImageElement | HTMLCanvasElement,
    redactions: Redaction[],
    options: Omit<RenderOptions, 'interactiveOverlay' | 'selectedId' | 'hoveredId'> = {},
    format: ImageExportFormat = IMAGE_EXPORT_FORMATS.png,
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
            reject(new Error(`Failed to generate ${format.label} blob from canvas.`));
          }
        },
        format.mimeType,
        format.quality,
      );
    });
  }

  static createFilename(
    baseName: string,
    date: string,
    format: ImageExportFormat,
  ): string {
    return `${baseName}-${date}.${format.extension}`;
  }

  static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  static async copyToClipboard(
    blob: Blob,
    format: ImageExportFormat,
  ): Promise<boolean> {
    try {
      if (typeof navigator.clipboard?.write === 'function') {
        const item = new ClipboardItem({ [format.mimeType]: blob });
        await navigator.clipboard.write([item]);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
