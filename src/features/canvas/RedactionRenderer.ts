import { Redaction } from '../../domain/redaction';
import { CATEGORY_CONFIG } from '../../shared/constants/categories';

export interface RenderOptions {
  interactiveOverlay?: boolean;
  selectedId?: string | null;
  hoveredId?: string | null;
  pixelateBlockSize?: number;
  blurRadius?: number;
  maskColor?: string;
}

export class RedactionRenderer {
  static drawRedactedImage(
    ctx: CanvasRenderingContext2D,
    image: CanvasImageSource,
    redactions: Redaction[],
    options: RenderOptions = {}
  ): void {
    const {
      interactiveOverlay = false,
      selectedId = null,
      hoveredId = null,
      pixelateBlockSize = 8,
      blurRadius = 12,
      maskColor = '#0f172a',
    } = options;

    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // 1. Draw base image
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    // 2. Apply active redactions using the established preview/export path.
    for (const redaction of redactions) {
      if (!redaction.enabled) continue;
      const [x0, y0, x1, y1] = redaction.bbox;
      const w = Math.max(1, x1 - x0);
      const h = Math.max(1, y1 - y0);

      switch (redaction.style) {
        case 'mask':
          this.drawMask(ctx, x0, y0, w, h, maskColor);
          break;
        case 'pixelate':
          this.drawPixelate(ctx, x0, y0, w, h, pixelateBlockSize);
          break;
        case 'blur':
          this.drawBlur(ctx, x0, y0, w, h, blurRadius);
          break;
      }
    }

    // 3. Draw interactive overlays (if in editor review mode)
    if (interactiveOverlay) {
      for (const redaction of redactions) {
        const [x0, y0, x1, y1] = redaction.bbox;
        const w = x1 - x0;
        const h = y1 - y0;
        const isSelected = redaction.id === selectedId;
        const isHovered = redaction.id === hoveredId;
        const meta = CATEGORY_CONFIG[redaction.category] || CATEGORY_CONFIG.custom;

        if (!redaction.enabled) {
          // Disabled redactions show faint dashed border
          ctx.save();
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(x0, y0, w, h);
          ctx.restore();
          continue;
        }

        ctx.save();
        if (isSelected) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(x0 - 1, y0 - 1, w + 2, h + 2);
          
          // Draw corner handles
          this.drawHandle(ctx, x0, y0);
          this.drawHandle(ctx, x1, y0);
          this.drawHandle(ctx, x0, y1);
          this.drawHandle(ctx, x1, y1);
        } else if (isHovered) {
          ctx.strokeStyle = meta.color || '#a855f7';
          ctx.lineWidth = 2;
          ctx.strokeRect(x0, y0, w, h);
        } else {
          ctx.strokeStyle = meta.borderColor || 'rgba(56, 189, 248, 0.5)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(x0, y0, w, h);
        }

        // Draw small category pill above box if selected or hovered
        if (isSelected || isHovered) {
          this.drawCategoryBadge(ctx, x0, y0, meta.short, meta.color);
        }
        ctx.restore();
      }
    }
  }

  private static drawMask(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
  ): void {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 3);
    ctx.fill();

    // Subtle hatch or inner border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  private static drawPixelate(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    blockSize: number
  ): void {
    ctx.save();
    const offCanvas = document.createElement('canvas');
    const cols = Math.max(1, Math.round(w / blockSize));
    const rows = Math.max(1, Math.round(h / blockSize));

    offCanvas.width = cols;
    offCanvas.height = rows;
    const offContext = offCanvas.getContext('2d');
    if (!offContext) {
      ctx.restore();
      return;
    }

    offContext.drawImage(ctx.canvas, x, y, w, h, 0, 0, cols, rows);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offCanvas, 0, 0, cols, rows, x, y, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
  }

  private static drawBlur(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.restore();
  }

  private static drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private static drawCategoryBadge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    label: string,
    color: string
  ): void {
    ctx.save();
    ctx.font = 'bold 10px IBM Plex Mono, monospace';
    const textWidth = ctx.measureText(label).width;
    const badgeW = textWidth + 8;
    const badgeH = 14;
    const badgeY = y - badgeH - 3 < 0 ? y + 3 : y - badgeH - 3;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, badgeY, badgeW, badgeH, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillText(label, x + 4, badgeY + 10);
    ctx.restore();
  }
}
