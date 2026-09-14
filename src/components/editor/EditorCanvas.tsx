import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Square,
  Hand,
  MousePointer,
  FileSearch2,
  Columns2,
} from "lucide-react";
import { Redaction } from "../../domain/redaction";
import { RedactionRenderer } from "../../features/canvas/RedactionRenderer";
import { BBox } from "../../domain/ocr";

interface EditorCanvasProps {
  image: HTMLImageElement;
  redactions: Redaction[];
  selectedId: string | null;
  onSelectRedaction: (id: string | null) => void;
  onAddManualRedaction: (bbox: BBox) => void;
  onUpdateRedactionBbox: (id: string, bbox: BBox) => void;
  onOpenDebug: () => void;
  hasDebugData: boolean;
  compareMode?: boolean;
  comparePosition?: number;
  onCompareModeChange: (comparing: boolean) => void;
  onComparePositionChange?: (position: number) => void;
  pixelateBlockSize?: number;
  blurRadius?: number;
  maskColor?: string;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  image,
  redactions,
  selectedId,
  onSelectRedaction,
  onAddManualRedaction,
  onUpdateRedactionBbox,
  onOpenDebug,
  hasDebugData,
  compareMode = false,
  comparePosition = 50,
  onCompareModeChange,
  onComparePositionChange,
  pixelateBlockSize,
  blurRadius,
  maskColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Viewport transform state
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isAdjustingCompare, setIsAdjustingCompare] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Tool mode: 'select' | 'draw' | 'pan'
  const [tool, setTool] = useState<"select" | "draw" | "pan">("select");

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [currentDrawBox, setCurrentDrawBox] = useState<BBox | null>(null);
  const [boxEdit, setBoxEdit] = useState<{
    id: string;
    mode: "move" | "nw" | "ne" | "sw" | "se";
    start: { x: number; y: number };
    original: BBox;
  } | null>(null);
  const [currentEditBox, setCurrentEditBox] = useState<BBox | null>(null);

  // Hover state
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const imgWidth = image.naturalWidth || image.width;
  const imgHeight = image.naturalHeight || image.height;

  // Fit to screen helper
  const handleFitToScreen = useCallback(() => {
    if (!viewportRef.current || !imgWidth || !imgHeight) return;
    const rect = viewportRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const padding = 40;
    const availableW = Math.max(100, rect.width - padding * 2);
    const availableH = Math.max(100, rect.height - padding * 2);

    const scaleW = availableW / imgWidth;
    const scaleH = availableH / imgHeight;
    const initialScale = Math.min(
      1.5,
      Math.max(0.05, Math.min(scaleW, scaleH)),
    );

    setScale(initialScale);
    setPan({
      x: Math.round((rect.width - imgWidth * initialScale) / 2),
      y: Math.round((rect.height - imgHeight * initialScale) / 2),
    });
  }, [imgWidth, imgHeight]);

  // Keep the image fitted when surrounding panels expand, collapse, or resize.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let frame = requestAnimationFrame(handleFitToScreen);
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(handleFitToScreen);
    });
    observer.observe(viewport);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [handleFitToScreen]);

  // Space key and shortcut tracking
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.closest("input, textarea, select, button, a") ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        setIsSpacePressed(true);
      } else if (!compareMode && (e.key === "v" || e.key === "V")) {
        setTool("select");
      } else if (!compareMode && (e.key === "r" || e.key === "R")) {
        setTool("draw");
      } else if (e.key === "h" || e.key === "H") {
        setTool("pan");
      } else if (e.key === "0") {
        handleFitToScreen();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [compareMode, handleFitToScreen]);

  // Render canvas whenever dependencies change
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderedRedactions =
      boxEdit && currentEditBox
        ? redactions.map((redaction) =>
            redaction.id === boxEdit.id
              ? { ...redaction, bbox: currentEditBox }
              : redaction,
          )
        : redactions;

    RedactionRenderer.drawRedactedImage(ctx, image, renderedRedactions, {
      interactiveOverlay: !compareMode,
      selectedId,
      hoveredId,
      pixelateBlockSize,
      blurRadius,
      maskColor,
    });

    if (compareMode) {
      const dividerX = Math.round((imgWidth * comparePosition) / 100);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, dividerX, imgHeight);
      ctx.clip();
      ctx.drawImage(image, 0, 0, imgWidth, imgHeight);
      ctx.restore();

      ctx.save();
      ctx.fillStyle = "#5ab8ff";
      const markerRadius = 14 / scale;
      const dividerWidth = Math.max(1, 2 / scale);
      ctx.fillRect(dividerX - dividerWidth / 2, 0, dividerWidth, imgHeight);
      ctx.beginPath();
      ctx.arc(dividerX, imgHeight / 2, markerRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#071017";
      ctx.lineWidth = Math.max(1, 1.5 / scale);
      ctx.stroke();
      ctx.fillStyle = "#071017";
      ctx.font = `700 ${14 / scale}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("↔", dividerX, imgHeight / 2);
      ctx.restore();
    }

    // Draw active drawing box preview
    if (!compareMode && currentDrawBox) {
      const [x0, y0, x1, y1] = currentDrawBox;
      ctx.save();
      ctx.fillStyle = "rgba(56, 189, 248, 0.2)";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.restore();
    }
  }, [
    image,
    redactions,
    selectedId,
    hoveredId,
    currentDrawBox,
    boxEdit,
    currentEditBox,
    pixelateBlockSize,
    blurRadius,
    maskColor,
    compareMode,
    comparePosition,
    scale,
    imgWidth,
    imgHeight,
  ]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Convert client viewport coordinates to canvas image pixel coordinates
  const clientToImageCoords = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(((clientX - rect.left) / rect.width) * imgWidth);
    const y = Math.round(((clientY - rect.top) / rect.height) * imgHeight);
    return {
      x: Math.max(0, Math.min(imgWidth, x)),
      y: Math.max(0, Math.min(imgHeight, y)),
    };
  };

  const updateComparePosition = (
    clientX: number,
    clampOutside = false,
  ): boolean => {
    const canvas = canvasRef.current;
    if (!canvas || !onComparePositionChange) return false;
    const rect = canvas.getBoundingClientRect();
    if (!clampOutside && (clientX < rect.left || clientX > rect.right))
      return false;
    const position = Math.max(
      0,
      Math.min(100, ((clientX - rect.left) / rect.width) * 100),
    );
    onComparePositionChange(Math.round(position));
    return true;
  };

  // Active wheel event listener for zoom to allow e.preventDefault()
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;

      setScale((prevScale) => {
        const newScale = Math.min(5, Math.max(0.05, prevScale * zoomFactor));
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setPan((prevPan) => ({
          x: mouseX - (mouseX - prevPan.x) * (newScale / prevScale),
          y: mouseY - (mouseY - prevPan.y) * (newScale / prevScale),
        }));
        return newScale;
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Mouse Down
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest(
        ".canvas-floating-toolbar, button, input, select, a",
      )
    ) return;

    if (
      compareMode &&
      e.button === 0 &&
      !isSpacePressed &&
      updateComparePosition(e.clientX)
    ) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsAdjustingCompare(true);
      return;
    }

    if (
      e.button === 1 ||
      (compareMode && e.button === 0) ||
      tool === "pan" ||
      (e.button === 0 && isSpacePressed)
    ) {
      // Pan mode
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.button === 0) {
      const coords = clientToImageCoords(e.clientX, e.clientY);

      if (tool === "draw") {
        setIsDrawing(true);
        setDrawStart(coords);
        setCurrentDrawBox([coords.x, coords.y, coords.x, coords.y]);
      } else if (tool === "select") {
        const selected = redactions.find(
          (redaction) => redaction.id === selectedId,
        );
        if (selected) {
          const [x0, y0, x1, y1] = selected.bbox;
          const threshold = Math.max(5, 10 / scale);
          const near = (x: number, y: number) =>
            Math.abs(coords.x - x) <= threshold &&
            Math.abs(coords.y - y) <= threshold;
          const mode = near(x0, y0)
            ? "nw"
            : near(x1, y0)
              ? "ne"
              : near(x0, y1)
                ? "sw"
                : near(x1, y1)
                  ? "se"
                  : coords.x >= x0 &&
                      coords.x <= x1 &&
                      coords.y >= y0 &&
                      coords.y <= y1
                    ? "move"
                    : null;

          if (mode) {
            setBoxEdit({
              id: selected.id,
              mode,
              start: coords,
              original: [...selected.bbox],
            });
            setCurrentEditBox([...selected.bbox]);
            return;
          }
        }

        // Hit test redactions
        const clicked = [...redactions].reverse().find((r) => {
          const [x0, y0, x1, y1] = r.bbox;
          return (
            coords.x >= x0 && coords.x <= x1 && coords.y >= y0 && coords.y <= y1
          );
        });

        onSelectRedaction(clicked ? clicked.id : null);
      }
    }
  };

  // Mouse Move
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isAdjustingCompare) {
      updateComparePosition(e.clientX, true);
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (compareMode) return;

    const coords = clientToImageCoords(e.clientX, e.clientY);

    if (boxEdit) {
      const deltaX = coords.x - boxEdit.start.x;
      const deltaY = coords.y - boxEdit.start.y;
      const [originalX0, originalY0, originalX1, originalY1] = boxEdit.original;
      const minimumSize = 6;
      let next: BBox;

      if (boxEdit.mode === "move") {
        const width = originalX1 - originalX0;
        const height = originalY1 - originalY0;
        const x0 = Math.max(0, Math.min(imgWidth - width, originalX0 + deltaX));
        const y0 = Math.max(
          0,
          Math.min(imgHeight - height, originalY0 + deltaY),
        );
        next = [x0, y0, x0 + width, y0 + height];
      } else {
        const movesLeft = boxEdit.mode === "nw" || boxEdit.mode === "sw";
        const movesTop = boxEdit.mode === "nw" || boxEdit.mode === "ne";
        const x0 = movesLeft
          ? Math.max(0, Math.min(originalX1 - minimumSize, originalX0 + deltaX))
          : originalX0;
        const x1 = movesLeft
          ? originalX1
          : Math.min(
              imgWidth,
              Math.max(originalX0 + minimumSize, originalX1 + deltaX),
            );
        const y0 = movesTop
          ? Math.max(0, Math.min(originalY1 - minimumSize, originalY0 + deltaY))
          : originalY0;
        const y1 = movesTop
          ? originalY1
          : Math.min(
              imgHeight,
              Math.max(originalY0 + minimumSize, originalY1 + deltaY),
            );
        next = [x0, y0, x1, y1];
      }
      setCurrentEditBox(next);
    } else if (isDrawing && drawStart) {
      const x0 = Math.min(drawStart.x, coords.x);
      const y0 = Math.min(drawStart.y, coords.y);
      const x1 = Math.max(drawStart.x, coords.x);
      const y1 = Math.max(drawStart.y, coords.y);
      setCurrentDrawBox([x0, y0, x1, y1]);
    } else if (tool === "select") {
      const hovered = [...redactions].reverse().find((r) => {
        const [x0, y0, x1, y1] = r.bbox;
        return (
          coords.x >= x0 && coords.x <= x1 && coords.y >= y0 && coords.y <= y1
        );
      });
      setHoveredId(hovered ? hovered.id : null);
    }
  };

  // Mouse Up
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (isAdjustingCompare) {
      setIsAdjustingCompare(false);
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (compareMode) return;

    if (boxEdit && currentEditBox) {
      onUpdateRedactionBbox(boxEdit.id, currentEditBox);
      setBoxEdit(null);
      setCurrentEditBox(null);
      return;
    }

    if (isDrawing && currentDrawBox) {
      const [x0, y0, x1, y1] = currentDrawBox;
      // Only register if box is at least 6x6 pixels
      if (x1 - x0 > 5 && y1 - y0 > 5) {
        onAddManualRedaction([x0, y0, x1, y1]);
      }
      setIsDrawing(false);
      setDrawStart(null);
      setCurrentDrawBox(null);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsAdjustingCompare(false);
    setIsPanning(false);
  };

  const handleViewportKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (compareMode || !selectedId || !event.key.startsWith("Arrow")) return;
    const selected = redactions.find((redaction) => redaction.id === selectedId);
    if (!selected) return;

    event.preventDefault();
    const amount = event.shiftKey ? 10 : 1;
    const deltaX = event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0;
    const deltaY = event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0;
    const [x0, y0, x1, y1] = selected.bbox;
    const width = x1 - x0;
    const height = y1 - y0;
    const nextX = Math.max(0, Math.min(imgWidth - width, x0 + deltaX));
    const nextY = Math.max(0, Math.min(imgHeight - height, y0 + deltaY));
    onUpdateRedactionBbox(selected.id, [nextX, nextY, nextX + width, nextY + height]);
  };

  return (
    <div
      className="canvas-viewport"
      ref={viewportRef}
      role="region"
      aria-label={
        compareMode
          ? "Screenshot comparison. Drag the divider to compare the original and redacted image."
          : "Screenshot redaction editor. Select a region, then use the arrow keys to move it."
      }
      tabIndex={0}
      onKeyDown={handleViewportKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div
        className={`canvas-container ${
          compareMode
            ? !isSpacePressed
              ? "comparing"
              : isPanning
                ? "is-panning"
                : "panning"
            : tool === "draw"
              ? "drawing"
              : tool === "pan"
                ? isPanning
                  ? "is-panning"
                  : "panning"
                : ""
        }`}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          width: `${imgWidth}px`,
          height: `${imgHeight}px`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={imgWidth}
          height={imgHeight}
          style={{ display: "block" }}
        />
      </div>

      {compareMode && (
        <div
          className="compare-canvas-labels"
          aria-hidden="true"
          style={{
            left: `${pan.x + 12}px`,
            top: `${pan.y + 12}px`,
            width: `${Math.max(0, imgWidth * scale - 24)}px`,
          }}
        >
          <span>Original</span>
          <span>Redacted</span>
        </div>
      )}

      {/* Floating Toolbar */}
      <div className="canvas-floating-toolbar" role="group" aria-label="Canvas controls">
        <div className="canvas-mode-switcher" role="group" aria-label="Canvas mode">
          <button
            type="button"
            className={!compareMode ? "active" : ""}
            onClick={() => onCompareModeChange(false)}
            aria-pressed={!compareMode}
          >
            Edit
          </button>
          <button
            type="button"
            className={compareMode ? "active" : ""}
            onClick={() => onCompareModeChange(true)}
            aria-pressed={compareMode}
          >
            <Columns2 size={14} aria-hidden="true" />
            Compare
          </button>
        </div>

        <div className="toolbar-divider" aria-hidden="true" />

        {compareMode ? (
          <>
            <span
              className="compare-pan-hint"
              role="note"
              aria-label="Drag the divider to compare. Hold Space and drag to pan."
              title="Drag the divider to compare. Hold Space and drag to pan."
            >
              <Hand size={14} aria-hidden="true" />
            </span>
            <label className="compare-slider-control">
              <span>Split</span>
              <input
                type="range"
                min="0"
                max="100"
                value={comparePosition}
                name="comparison-position"
                aria-label="Original and redacted comparison position"
                onChange={(event) => onComparePositionChange?.(Number(event.target.value))}
              />
            </label>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`toolbar-btn ${tool === "select" ? "active" : ""}`}
              onClick={() => setTool("select")}
              aria-pressed={tool === "select"}
              title="Select & Inspect Redactions (V)"
              aria-label="Select and adjust redactions"
            >
              <MousePointer size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`toolbar-btn ${tool === "draw" ? "active" : ""}`}
              onClick={() => setTool("draw")}
              aria-pressed={tool === "draw"}
              title="Draw Manual Redaction Box (R)"
              aria-label="Draw a manual redaction box"
            >
              <Square size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`toolbar-btn ${tool === "pan" ? "active" : ""}`}
              onClick={() => setTool("pan")}
              aria-pressed={tool === "pan"}
              title="Pan Canvas View (H or Spacebar)"
              aria-label="Pan the canvas"
            >
              <Hand size={16} aria-hidden="true" />
            </button>
          </>
        )}

        <div className="toolbar-divider" aria-hidden="true" />

        <button
          type="button"
          className="toolbar-btn"
          onClick={() => setScale((s) => Math.max(0.2, s * 0.85))}
          title="Zoom Out"
          aria-label="Zoom out"
        >
          <ZoomOut size={16} aria-hidden="true" />
        </button>

        <span className="zoom-text">{Math.round(scale * 100)}%</span>

        <button
          type="button"
          className="toolbar-btn"
          onClick={() => setScale((s) => Math.min(5, s * 1.15))}
          title="Zoom In"
          aria-label="Zoom in"
        >
          <ZoomIn size={16} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="toolbar-btn"
          onClick={handleFitToScreen}
          title="Fit to Screen"
          aria-label="Fit image to screen"
        >
          <Maximize2 size={16} aria-hidden="true" />
        </button>

        {!compareMode && (
          <>
            <div className="toolbar-divider" aria-hidden="true" />
            <button
              type="button"
              className="toolbar-btn canvas-debug-btn"
              onClick={onOpenDebug}
              disabled={!hasDebugData}
              title="Inspect raw OCR and detector output"
              aria-label="Open detection debug data"
            >
              <FileSearch2 size={16} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
