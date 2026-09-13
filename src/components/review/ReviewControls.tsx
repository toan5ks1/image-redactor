import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, Download, ShieldCheck } from 'lucide-react';
import { Redaction } from '../../domain/redaction';
import { ImageExporter } from '../../features/export/ImageExporter';
import { ReviewView } from '../editor/EditorCanvas';

interface ReviewToolbarProps {
  view: ReviewView;
  findingCount: number;
  protectedCount: number;
  onViewChange: (view: ReviewView) => void;
  onBack: () => void;
}

const REVIEW_VIEWS: Array<{ value: ReviewView; label: string }> = [
  { value: 'redacted', label: 'Redacted' },
  { value: 'original', label: 'Original' },
  { value: 'compare', label: 'Compare' },
];

export const ReviewToolbar: React.FC<ReviewToolbarProps> = ({
  view,
  findingCount,
  protectedCount,
  onViewChange,
  onBack,
}) => (
  <nav className="review-toolbar" aria-label="Review controls">
    <div className="review-toolbar-inner">
      <div className="review-context">
        <button type="button" className="review-back-btn" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Edit
        </button>
        <div className="review-heading">
          <h1>Review Redacted Image</h1>
          <span>
            {findingCount} {findingCount === 1 ? 'finding' : 'findings'} ·{' '}
            {protectedCount === findingCount
              ? 'All protected'
              : `${protectedCount} protected`}
          </span>
        </div>
      </div>

      <div className="review-view-switcher" role="group" aria-label="Image view">
        {REVIEW_VIEWS.map((option) => (
          <button
            type="button"
            key={option.value}
            className={view === option.value ? 'active' : ''}
            aria-pressed={view === option.value}
            onClick={() => onViewChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  </nav>
);

interface ReviewExportBarProps {
  image: HTMLImageElement;
  redactions: Redaction[];
  isDetectionDegraded: boolean;
}

export const ReviewExportBar: React.FC<ReviewExportBarProps> = ({
  image,
  redactions,
  isDetectionDegraded,
}) => {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [isExporting, setIsExporting] = useState(true);
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [riskAccepted, setRiskAccepted] = useState(false);

  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const enabledCount = redactions.reduce(
    (count, redaction) => count + (redaction.enabled ? 1 : 0),
    0
  );
  const disabledCount = redactions.length - enabledCount;

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
        const message = error instanceof Error ? error.message : 'Unknown export error.';
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
      setExportError('Clipboard access failed. You can still download the PNG.');
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section className="review-export-bar" aria-label="Export redacted image">
      <div className="review-export-inner">
        <div className={`review-safety-message ${disabledCount > 0 ? 'needs-review' : ''}`}>
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>{disabledCount > 0 ? 'Review Before Export' : 'Ready to Export'}</strong>
            <span>
              {disabledCount > 0
                ? `${disabledCount} ${disabledCount === 1 ? 'finding is' : 'findings are'} excluded from protection.`
                : 'Compare both views, then copy or download your image.'}
            </span>
            {isDetectionDegraded && (
              <label>
                <input
                  type="checkbox"
                  checked={riskAccepted}
                  onChange={(event) => setRiskAccepted(event.target.checked)}
                />
                I reviewed this rules-only result and accept the detection risk.
              </label>
            )}
          </div>
        </div>

        <div className="review-export-actions">
          <div className="review-file-meta">
            <strong>{imageWidth} × {imageHeight} px PNG</strong>
            <span>Processed locally · 0 bytes uploaded</span>
          </div>

          {exportError && <div className="review-export-error" role="alert">{exportError}</div>}

          <button
            type="button"
            className="secondary-btn"
            onClick={handleCopy}
            disabled={exportDisabled}
            aria-live="polite"
          >
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={handleDownload}
            disabled={exportDisabled}
          >
            <Download size={16} aria-hidden="true" />
            {isExporting ? 'Preparing PNG…' : 'Download PNG'}
          </button>
        </div>
      </div>
    </section>
  );
};
