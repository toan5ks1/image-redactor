import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, ShieldCheck, X } from "lucide-react";
import { Redaction } from "../../domain/redaction";
import { ImageExporter } from "../../features/export/ImageExporter";

interface ExportPanelProps {
  image: HTMLImageElement;
  redactions: Redaction[];
  isDetectionDegraded: boolean;
  onClose: () => void;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  image,
  redactions,
  isDetectionDegraded,
  onClose,
}) => {
  const dialogRef = useRef<HTMLElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [isExporting, setIsExporting] = useState(true);
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [riskAccepted, setRiskAccepted] = useState(false);

  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const protectedCount = redactions.reduce(
    (count, redaction) => count + (redaction.enabled ? 1 : 0),
    0,
  );
  const excludedCount = redactions.length - protectedCount;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialog.contains(activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setBlob(null);
    setExportError(null);
    setIsExporting(true);

    void ImageExporter.exportRedactedImage(image, redactions)
      .then((result) => {
        if (!cancelled) setBlob(result);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unknown export error.";
        setExportError(`Export failed: ${message}`);
      })
      .finally(() => {
        if (!cancelled) setIsExporting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [image, redactions]);

  const exportDisabled =
    isExporting || !blob || (isDetectionDegraded && !riskAccepted);

  const handleDownload = () => {
    if (!blob) return;
    const date = new Date().toISOString().slice(0, 10);
    ImageExporter.downloadBlob(blob, `redacted-screenshot-${date}.png`);
  };

  const handleCopy = async () => {
    if (!blob) return;
    const success = await ImageExporter.copyToClipboard(blob);
    if (!success) {
      setExportError("Clipboard access failed. Download the PNG instead.");
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="export-panel-backdrop">
      <section
        ref={dialogRef}
        className="export-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-panel-title"
        aria-describedby="export-panel-description"
        tabIndex={-1}
      >
        <header className="export-panel-header">
          <div>
            <span className="export-panel-eyebrow">Local Export</span>
            <h2 id="export-panel-title">Export Redacted Image</h2>
            <p id="export-panel-description">
              Your original image stays on this device.
            </p>
          </div>
          <button
            type="button"
            className="toolbar-btn"
            onClick={onClose}
            aria-label="Close export panel"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </header>

        <div className="export-panel-body">
          <div className={`export-safety ${excludedCount > 0 ? "needs-review" : ""}`}>
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <strong>
                {excludedCount > 0
                  ? `${excludedCount} ${excludedCount === 1 ? "finding is" : "findings are"} excluded`
                  : `All ${protectedCount} ${protectedCount === 1 ? "finding is" : "findings are"} protected`}
              </strong>
              <span>
                {excludedCount > 0
                  ? "Return to the findings list if this was not intentional."
                  : "The exported PNG includes every enabled redaction."}
              </span>
            </div>
          </div>

          {isDetectionDegraded ? (
            <label className="export-risk-check">
              <input
                type="checkbox"
                checked={riskAccepted}
                onChange={(event) => setRiskAccepted(event.target.checked)}
              />
              I reviewed this rules-only result and accept the detection risk.
            </label>
          ) : null}

          <div className="export-file-meta">
            <div>
              <span>Format</span>
              <strong>PNG</strong>
            </div>
            <div>
              <span>Dimensions</span>
              <strong>{imageWidth} × {imageHeight}&nbsp;px</strong>
            </div>
            <div>
              <span>Upload</span>
              <strong>0 bytes</strong>
            </div>
          </div>

          {exportError ? (
            <div className="export-panel-error" role="alert">
              {exportError}
            </div>
          ) : null}
        </div>

        <footer className="export-panel-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={handleCopy}
            disabled={exportDisabled}
            aria-live="polite"
          >
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied ? "Copied" : "Copy Image"}
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={handleDownload}
            disabled={exportDisabled}
          >
            <Download size={16} aria-hidden="true" />
            {isExporting ? "Preparing PNG…" : "Download PNG"}
          </button>
        </footer>
      </section>
    </div>
  );
};
