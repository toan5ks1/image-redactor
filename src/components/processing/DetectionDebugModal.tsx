import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clipboard, X } from 'lucide-react';
import { OCRResult } from '../../domain/ocr';
import { SensitiveEntity } from '../../domain/sensitive-entity';

export interface DetectionDebugData {
  ocrResult: OCRResult;
  modelInputText: string;
  ruleEntities: SensitiveEntity[];
  modelEntities: SensitiveEntity[];
  modelError?: string;
}

interface DetectionDebugModalProps {
  data: DetectionDebugData;
  onClose: () => void;
}

type DebugTab = 'ocr' | 'entities';

export const DetectionDebugModal: React.FC<DetectionDebugModalProps> = ({ data, onClose }) => {
  const [activeTab, setActiveTab] = useState<DebugTab>('ocr');
  const [copied, setCopied] = useState<'text' | 'json' | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const entities = useMemo(
    () => [...data.ruleEntities, ...data.modelEntities],
    [data.modelEntities, data.ruleEntities]
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), summary, [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleTabsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const nextTab: DebugTab = activeTab === 'ocr' ? 'entities' : 'ocr';
    setActiveTab(nextTab);
    event.currentTarget
      .querySelector<HTMLButtonElement>(`#debug-tab-${nextTab}`)
      ?.focus();
  };

  const copyValue = async (kind: 'text' | 'json') => {
    const value =
      kind === 'text'
        ? data.modelInputText
        : JSON.stringify(
            {
              analyzedText: data.modelInputText,
              ocr: data.ocrResult,
              detections: {
                rules: data.ruleEntities,
                ai: data.modelEntities,
                analysisError: data.modelError,
              },
            },
            null,
            2
          );

    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div
      className="modal-backdrop debug-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="modal-dialog debug-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="debug-modal-title"
        onKeyDown={handleDialogKeyDown}
      >
        <header className="debug-modal-header">
          <div>
            <p className="debug-modal-eyebrow">Local pipeline inspection</p>
            <h2 id="debug-modal-title">Detection Debug Data</h2>
          </div>
          <button ref={closeButtonRef} type="button" className="toolbar-btn" onClick={onClose} aria-label="Close debug data">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="debug-summary" aria-label="Detection summary">
          <span><strong>{data.ocrResult.lines.length}</strong> OCR regions</span>
          <span><strong>{data.ruleEntities.length}</strong> rule matches</span>
          <span><strong>{data.modelEntities.length}</strong> AI matches</span>
        </div>

        <div className="debug-tabs" role="tablist" aria-label="Debug data view" onKeyDown={handleTabsKeyDown}>
          <button
            id="debug-tab-ocr"
            type="button"
            role="tab"
            aria-selected={activeTab === 'ocr'}
            aria-controls="debug-panel-ocr"
            tabIndex={activeTab === 'ocr' ? 0 : -1}
            className={activeTab === 'ocr' ? 'active' : ''}
            onClick={() => setActiveTab('ocr')}
          >
            Recognized text
          </button>
          <button
            id="debug-tab-entities"
            type="button"
            role="tab"
            aria-selected={activeTab === 'entities'}
            aria-controls="debug-panel-entities"
            tabIndex={activeTab === 'entities' ? 0 : -1}
            className={activeTab === 'entities' ? 'active' : ''}
            onClick={() => setActiveTab('entities')}
          >
            Sensitive detections ({entities.length})
          </button>
        </div>

        <div className="debug-modal-content">
          {activeTab === 'ocr' ? (
            <div id="debug-panel-ocr" className="debug-panel" role="tabpanel" aria-labelledby="debug-tab-ocr">
              <div className="debug-panel-heading">
                <div>
                  <h3>Exact text analyzed for sensitive information</h3>
                  <p>Line breaks are preserved to retain document context.</p>
                </div>
                <button type="button" className="secondary-btn debug-copy-btn" onClick={() => void copyValue('text')}>
                  {copied === 'text' ? <Check size={14} aria-hidden="true" /> : <Clipboard size={14} aria-hidden="true" />}
                  {copied === 'text' ? 'Copied' : 'Copy text'}
                </button>
              </div>
              <pre className="debug-raw-text">{data.modelInputText || '(No text recognized)'}</pre>

              {data.ocrResult.fullText !== data.modelInputText && (
                <details className="debug-details">
                  <summary>Recognized text differs from analyzed text</summary>
                  <pre className="debug-raw-text">{data.ocrResult.fullText}</pre>
                </details>
              )}

              <details className="debug-details">
                <summary>OCR region geometry and confidence</summary>
                <div className="debug-record-list">
                  {data.ocrResult.lines.map((line, index) => (
                    <article className="debug-record" key={line.id}>
                      <div className="debug-record-meta">
                        <span>Region {index + 1}</span>
                        <span>{formatConfidence(line.confidence)}</span>
                        <code>{formatBbox(line.bbox)}</code>
                      </div>
                      <p>{line.text}</p>
                    </article>
                  ))}
                </div>
              </details>
            </div>
          ) : (
            <div id="debug-panel-entities" className="debug-panel" role="tabpanel" aria-labelledby="debug-tab-entities">
              <div className="debug-panel-heading">
                <div>
                  <h3>Detector output before overlap de-duplication</h3>
                  <p>These are the raw matches used to create automatic blur or mask boxes.</p>
                </div>
                <button type="button" className="secondary-btn debug-copy-btn" onClick={() => void copyValue('json')}>
                  {copied === 'json' ? <Check size={14} aria-hidden="true" /> : <Clipboard size={14} aria-hidden="true" />}
                  {copied === 'json' ? 'Copied' : 'Copy JSON'}
                </button>
              </div>

              {data.modelError && <div className="debug-error">AI detector error: {data.modelError}</div>}

              {entities.length === 0 ? (
                <div className="debug-empty">No sensitive information was detected.</div>
              ) : (
                <div className="debug-record-list">
                  {entities.map((entity) => (
                    <article className="debug-record debug-entity-record" key={entity.id}>
                      <div className="debug-record-meta">
                        <span className={`debug-source ${entity.detector}`}>
                          {formatDetectorSource(entity.detector)}
                        </span>
                        <span>{entity.category}</span>
                        <span>{formatConfidence(entity.confidence)}</span>
                      </div>
                      <p>{entity.text}</p>
                      <div className="debug-record-coordinates">
                        <code>bbox {formatBbox(entity.bbox)}</code>
                        {entity.lineId ? <code>{entity.lineId}</code> : null}
                        {entity.start !== undefined && entity.end !== undefined ? (
                          <code>chars {entity.start}–{entity.end}</code>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

function formatConfidence(confidence?: number): string {
  return confidence === undefined ? 'confidence n/a' : `${Math.round(confidence * 100)}% confidence`;
}

function formatDetectorSource(source: SensitiveEntity['detector']): string {
  if (source === 'privacy-filter') return 'AI match';
  if (source === 'rules') return 'Rule match';
  return 'Manual';
}

function formatBbox(bbox: [number, number, number, number]): string {
  return `[${bbox.map((value) => Math.round(value)).join(', ')}]`;
}
