import React, { useRef, useState, useEffect, useCallback } from 'react';
import { UploadCloud, Sparkles, ShieldCheck, ScanText } from 'lucide-react';
import { createSampleDeveloperScreenshot } from '../../shared/utils/image';

interface DropZoneProps {
  onFileSelect: (file: File | Blob) => void;
  isLoading: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFileSelect,
  isLoading,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFileSelect(e.dataTransfer.files[0]);
      }
    },
    [onFileSelect]
  );

  // Global clipboard paste listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isLoading) return;
      if (e.clipboardData && e.clipboardData.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (blob) {
              onFileSelect(blob);
              break;
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFileSelect, isLoading]);

  const handleSampleClick = async () => {
    const sampleBlob = await createSampleDeveloperScreenshot();
    onFileSelect(sampleBlob);
  };

  return (
    <div className="landing-view">
      <div className="landing-shell">
        <div className="landing-grid">
          <section className="landing-hero" aria-labelledby="landing-title">
            <p className="landing-eyebrow">
              <ShieldCheck size={14} aria-hidden="true" /> Private by architecture
            </p>
            <h1 id="landing-title">
              Redact screenshots.
              <span>Keep them private.</span>
            </h1>
            <p>
              Paste an image, find sensitive information, and review every mask before sharing.
              Your screenshot stays in this browser.
            </p>

            <details className="privacy-details">
              <summary>How local processing works</summary>
              <div>
                <p>Your image is decoded and analyzed in browser memory. It is never uploaded.</p>
                <p>Detection resources may download to your browser before the first scan.</p>
              </div>
            </details>
          </section>

          <div className="redaction-demo" aria-hidden="true">
            <div className="demo-window-bar">
              <span />
              <span />
              <span />
              <b>LOCAL PREVIEW</b>
            </div>
            <div className="demo-document">
              <div className="demo-document-mark">PRIVATE / 04</div>
              <span className="demo-line wide" />
              <span className="demo-line medium" />
              <span className="demo-line short" />
              <span className="demo-redaction first" />
              <span className="demo-redaction second" />
              <span className="demo-detection-box" />
              <div className="demo-status">
                <ScanText size={14} /> 4 regions protected
              </div>
            </div>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          hidden
          name="screenshot"
          aria-label="Screenshot file"
          accept="image/png,image/jpeg,.png,.jpg,.jpeg"
          onChange={(event) => {
            if (event.target.files?.[0]) {
              const file = event.target.files[0];
              event.target.value = '';
              onFileSelect(file);
            }
          }}
        />

        <button
          type="button"
          className={`dropzone-card ${isDragOver ? 'drag-over' : ''}`}
          aria-label="Choose a PNG or JPEG screenshot, or drag and drop it here"
          disabled={isLoading}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="dropzone-icon">
            <UploadCloud size={22} aria-hidden="true" />
          </span>
          <span className="dropzone-copy">
            <span className="dropzone-primary-text">Drop a screenshot or choose a file</span>
            <span className="dropzone-secondary-text">
              PNG or JPEG · up to 20&nbsp;MB · 10,000 × 10,000&nbsp;px
            </span>
          </span>
          <span className="dropzone-paste-badge">
            Paste with <kbd className="kbd-badge">Ctrl&nbsp;V</kbd>
            <span aria-hidden="true">/</span>
            <kbd className="kbd-badge">⌘&nbsp;V</kbd>
          </span>
        </button>

        <div className="landing-footer-row">
          <button
            type="button"
            className="sample-btn"
            onClick={handleSampleClick}
            disabled={isLoading}
          >
            <Sparkles size={15} aria-hidden="true" />
            <span>Try a Sample Screenshot</span>
          </button>
          <p className="privacy-warning" role="note">
            Automatic detection can miss information. Review every mask before sharing.
          </p>
        </div>
      </div>
    </div>
  );
};
