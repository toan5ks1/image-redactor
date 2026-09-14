import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { DropZone } from './components/upload/DropZone';
import { ProcessingScanner } from './components/processing/ProcessingScanner';
import {
  DetectionDebugData,
  DetectionDebugModal,
} from './components/processing/DetectionDebugModal';
import { EditorCanvas } from './components/editor/EditorCanvas';
import { EntitySidebar } from './components/editor/EntitySidebar';
import { ExportPanel } from './components/export/ExportPanel';

import { Redaction, RedactionStyle } from './domain/redaction';
import { BBox, OCRResult } from './domain/ocr';
import { SensitiveEntity } from './domain/sensitive-entity';
import type { WorkerPrivacyDetector } from './engines/privacy/WorkerPrivacyDetector';

import { PaddleOCREngine } from './engines/ocr/PaddleOCREngine';
import { RulesDetector } from './engines/privacy/RulesDetector';
import { EntityBoxMapper } from './engines/mapping/EntityBoxMapper';
import { buildOCRDocument } from './engines/mapping/OCRDocumentMapper';
import { loadImageFromFile } from './shared/utils/image';
import { useUndoRedo } from './features/history/useUndoRedo';

type ProcessingPhase =
  | 'idle'
  | 'loading-image'
  | 'loading-ocr-model'
  | 'running-ocr'
  | 'loading-privacy-filter'
  | 'detecting-sensitive-data'
  | 'preparing-editor'
  | 'ready'
  | 'failed';

interface AppNotice {
  kind: 'error' | 'warning';
  message: string;
}

export const App: React.FC = () => {
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);
  const [processingImage, setProcessingImage] = useState<HTMLImageElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>('idle');
  const [notice, setNotice] = useState<AppNotice | null>(null);
  const [isDetectionDegraded, setIsDetectionDegraded] = useState(false);
  const [debugData, setDebugData] = useState<DetectionDebugData | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [progressState, setProgressState] = useState({
    title: 'Initializing Engine…',
    subtitle: 'Preparing local processing on your device…',
    progress: 5,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [padding, setPadding] = useState<number>(4);
  const [isComparing, setIsComparing] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [comparePosition, setComparePosition] = useState(50);

  // Engine singletons
  const paddleEngineRef = useRef<PaddleOCREngine>(new PaddleOCREngine());
  const rulesDetectorRef = useRef<RulesDetector>(new RulesDetector());
  const onnxDetectorRef = useRef<WorkerPrivacyDetector | null>(null);
  const processingAbortRef = useRef<AbortController | null>(null);
  const currentImageUrlRef = useRef<string | null>(null);
  const pendingImageUrlRef = useRef<string | null>(null);

  const {
    redactions,
    setRedactions,
    reset: resetRedactions,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoRedo([]);

  const releaseObjectUrl = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    return () => {
      processingAbortRef.current?.abort();
      releaseObjectUrl(pendingImageUrlRef.current);
      releaseObjectUrl(currentImageUrlRef.current);
      onnxDetectorRef.current?.terminate();
      void paddleEngineRef.current.terminate();
    };
  }, [releaseObjectUrl]);

  const handleCancelProcessing = useCallback(() => {
    processingAbortRef.current?.abort();
    processingAbortRef.current = null;
    releaseObjectUrl(pendingImageUrlRef.current);
    pendingImageUrlRef.current = null;
    setProcessingImage(null);
    setIsProcessing(false);
    setProcessingPhase('idle');
    setNotice({ kind: 'warning', message: 'Processing was cancelled. No result was saved.' });
  }, [releaseObjectUrl]);

  // Process uploaded or pasted image
  const handleProcessImage = useCallback(async (file: File | Blob) => {
    processingAbortRef.current?.abort();
    const abortController = new AbortController();
    processingAbortRef.current = abortController;
    const { signal } = abortController;

    setNotice(null);
    setIsDetectionDegraded(false);
    setDebugData(null);
    setIsDebugOpen(false);
    setIsProcessing(true);
    setProcessingImage(null);
    setProcessingPhase('loading-image');
    setProgressState({
      title: 'Loading Image…',
      subtitle: 'Decoding pixels locally in browser memory…',
      progress: 8,
    });

    let loadedObjectUrl: string | null = null;
    try {
      const loaded = await loadImageFromFile(file);
      const img = loaded.image;
      loadedObjectUrl = loaded.objectUrl;
      signal.throwIfAborted();
      pendingImageUrlRef.current = loadedObjectUrl;
      setProcessingImage(img);

      const imgWidth = img.naturalWidth || img.width;
      const imgHeight = img.naturalHeight || img.height;

      // Stage 1: Local Neural OCR with PaddleOCR
      const ocrEngine = paddleEngineRef.current;

      setProcessingPhase('loading-ocr-model');
      setProgressState({
        title: 'Scanning Image…',
        subtitle: 'Finding and reading text locally…',
        progress: 15,
      });

      const ocrResult: OCRResult = await ocrEngine.recognize(
        file,
        (p) => {
          if (signal.aborted) return;
          setProcessingPhase(p.progress < 40 ? 'loading-ocr-model' : 'running-ocr');
          setProgressState({
            title: 'Scanning Text…',
            subtitle: p.status,
            progress: 15 + Math.round((p.progress / 100) * 40),
          });
        },
        signal
      );
      signal.throwIfAborted();
      const modelInputText = buildOCRDocument(ocrResult).text;
      setDebugData({
        ocrResult,
        modelInputText,
        ruleEntities: [],
        modelEntities: [],
      });

      // Stage 2: Sensitive Detection (Rules + ONNX Privacy Filter)
      setProcessingPhase('detecting-sensitive-data');
      setProgressState({
        title: 'Detecting Sensitive Data…',
        subtitle: 'Applying deterministic security rules & API key patterns…',
        progress: 60,
      });

      const ruleEntities = await rulesDetectorRef.current.detect(ocrResult, undefined, signal);
      setDebugData({
        ocrResult,
        modelInputText,
        ruleEntities,
        modelEntities: [],
      });

      // Apply deterministic detections immediately
      const initialRedactions = EntityBoxMapper.createRedactions(ruleEntities, {
        padding,
        imageWidth: imgWidth,
        imageHeight: imgHeight,
      });

      setProcessingPhase('loading-privacy-filter');
      setProgressState({
        title: 'Analyzing Sensitive Information…',
        subtitle: 'Reviewing recognized text locally…',
        progress: 75,
      });

      let finalRedactions = initialRedactions;
      let privacyFilterWarning: string | null = null;
      let onnxEntities: SensitiveEntity[] = [];

      try {
        if (!onnxDetectorRef.current) {
          const { WorkerPrivacyDetector: Detector } = await import(
            './engines/privacy/WorkerPrivacyDetector'
          );
          onnxDetectorRef.current = new Detector();
        }
        signal.throwIfAborted();

        onnxEntities = await onnxDetectorRef.current.detect(
          ocrResult,
          (p) => {
            if (signal.aborted) return;
            setProcessingPhase(
              p.progress < 95 ? 'detecting-sensitive-data' : 'preparing-editor'
            );
            setProgressState({
              title: 'Analyzing Sensitive Information…',
              subtitle: p.status,
              progress: 75 + Math.round((p.progress / 100) * 20),
            });
          },
          signal
        );
        signal.throwIfAborted();

        if (onnxEntities.length > 0) {
          finalRedactions = EntityBoxMapper.createRedactions([...ruleEntities, ...onnxEntities], {
            padding,
            imageWidth: imgWidth,
            imageHeight: imgHeight,
          });
        }
      } catch (error) {
        if (signal.aborted) signal.throwIfAborted();
        privacyFilterWarning =
          error instanceof Error
            ? error.message
            : 'Sensitive information analysis failed for an unknown reason.';
      }

      setDebugData({
        ocrResult,
        modelInputText,
        ruleEntities,
        modelEntities: onnxEntities,
        modelError: privacyFilterWarning || undefined,
      });

      setProcessingPhase('preparing-editor');
      setProgressState({
        title: 'Preparing Editor…',
        subtitle: 'Mapping findings to image coordinates…',
        progress: 98,
      });
      signal.throwIfAborted();

      resetRedactions(finalRedactions);
      releaseObjectUrl(currentImageUrlRef.current);
      currentImageUrlRef.current = loadedObjectUrl;
      pendingImageUrlRef.current = null;
      loadedObjectUrl = null;
      setCurrentImage(img);
      setProcessingImage(null);

      if (privacyFilterWarning) {
        setIsDetectionDegraded(true);
        setProcessingPhase('failed');
        setNotice({
          kind: 'warning',
          message: `${privacyFilterWarning} Basic protection was applied, but some sensitive information may have been missed. Review the image carefully.`,
        });
      } else {
        setIsDetectionDegraded(false);
        setProcessingPhase('ready');
        setProgressState({
          title: 'Ready to Edit',
          subtitle: 'Detection complete',
          progress: 100,
        });
      }
    } catch (error) {
      releaseObjectUrl(loadedObjectUrl);
      if (pendingImageUrlRef.current === loadedObjectUrl) pendingImageUrlRef.current = null;

      if (signal.aborted) return;
      const message = error instanceof Error ? error.message : 'An unknown processing error occurred.';
      setProcessingPhase('failed');
      setNotice({
        kind: 'error',
        message: `Image processing failed: ${message} No redacted result was produced.`,
      });
    } finally {
      if (processingAbortRef.current === abortController) {
        processingAbortRef.current = null;
        setProcessingImage(null);
        setIsProcessing(false);
      }
    }
  }, [padding, releaseObjectUrl, resetRedactions]);

  useEffect(() => {
    if (!currentImage) return;
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== 'z'
      ) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', handleHistoryShortcut);
    return () => window.removeEventListener('keydown', handleHistoryShortcut);
  }, [currentImage, redo, undo]);

  useEffect(() => {
    if (!isComparing || isExportOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsComparing(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isComparing, isExportOpen]);

  // Toggle individual redaction
  const handleToggleRedaction = useCallback(
    (id: string) => {
      setRedactions((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
      );
    },
    [setRedactions]
  );

  // Change individual redaction style
  const handleChangeStyle = useCallback(
    (id: string, style: RedactionStyle) => {
      setRedactions((prev) =>
        prev.map((r) => (r.id === id ? { ...r, style } : r))
      );
    },
    [setRedactions]
  );

  // Delete redaction
  const handleDeleteRedaction = useCallback(
    (id: string) => {
      setRedactions((prev) => prev.filter((r) => r.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
      }
    },
    [selectedId, setRedactions]
  );

  // Batch enable / disable
  const handleBatchToggleAll = useCallback(
    (enable: boolean) => {
      setRedactions((prev) => prev.map((r) => ({ ...r, enabled: enable })));
    },
    [setRedactions]
  );

  // Batch set style
  const handleBatchSetStyle = useCallback(
    (style: RedactionStyle) => {
      setRedactions((prev) => prev.map((r) => ({ ...r, style })));
    },
    [setRedactions]
  );

  // Padding change: reapply padding to all automatic redactions
  const handlePaddingChange = useCallback(
    (newPadding: number) => {
      setPadding(newPadding);
      if (!currentImage) return;
      const imgW = currentImage.naturalWidth || currentImage.width;
      const imgH = currentImage.naturalHeight || currentImage.height;

      setRedactions((prev) =>
        prev.map((r) => {
          if (r.source === 'manual') return r;
          const updatedBox = EntityBoxMapper.applyPadding(r.baseBbox, newPadding, imgW, imgH);
          return { ...r, bbox: updatedBox };
        })
      );
    },
    [currentImage, setRedactions]
  );

  // Add manual redaction box
  const handleAddManualRedaction = useCallback(
    (bbox: BBox) => {
      const newRedaction: Redaction = {
        id: `manual_redaction_${Date.now()}`,
        bbox,
        baseBbox: bbox,
        category: 'custom',
        style: 'blur',
        source: 'manual',
        matchedBy: ['manual'],
        enabled: true,
        label: 'Manual Redaction',
      };
      setRedactions((prev) => [...prev, newRedaction]);
      setSelectedId(newRedaction.id);
    },
    [setRedactions]
  );

  const handleUpdateRedactionBbox = useCallback(
    (id: string, bbox: BBox) => {
      if (!currentImage) return;
      const imageWidth = currentImage.naturalWidth || currentImage.width;
      const imageHeight = currentImage.naturalHeight || currentImage.height;
      const clamped = EntityBoxMapper.clampBbox(bbox, imageWidth, imageHeight);
      setRedactions((previous) =>
        previous.map((redaction) =>
          redaction.id === id
            ? { ...redaction, bbox: clamped, baseBbox: clamped }
            : redaction
        )
      );
    },
    [currentImage, setRedactions]
  );

  const handleReset = () => {
    processingAbortRef.current?.abort();
    processingAbortRef.current = null;
    releaseObjectUrl(pendingImageUrlRef.current);
    pendingImageUrlRef.current = null;
    releaseObjectUrl(currentImageUrlRef.current);
    currentImageUrlRef.current = null;
    setCurrentImage(null);
    resetRedactions([]);
    setSelectedId(null);
    setNotice(null);
    setIsDetectionDegraded(false);
    setDebugData(null);
    setIsDebugOpen(false);
    setProcessingPhase('idle');
    setIsComparing(false);
    setIsExportOpen(false);
    setComparePosition(50);
  };

  const handleCompareModeChange = useCallback((comparing: boolean) => {
    if (comparing) setSelectedId(null);
    setIsComparing(comparing);
  }, []);

  const handleOpenExport = useCallback(() => setIsExportOpen(true), []);
  const handleCloseExport = useCallback(() => setIsExportOpen(false), []);

  const handleOpenDebug = useCallback(() => {
    setIsDebugOpen(true);
  }, []);

  return (
    <div className="app-container">
      <a className="skip-link" href="#main-content">
        Skip to Main Content
      </a>
      <Header
        hasImage={!!currentImage}
        isEditing={true}
        onReset={handleReset}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      {notice && (
        <div className={`app-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">
            Dismiss
          </button>
        </div>
      )}

      <main id="main-content" className="main-content" tabIndex={-1}>
        {isProcessing && processingImage ? (
          <ProcessingScanner
            image={processingImage}
            title={progressState.title}
            subtitle={progressState.subtitle}
            progress={progressState.progress}
            phase={processingPhase}
            onCancel={handleCancelProcessing}
          />
        ) : !currentImage ? (
          <DropZone onFileSelect={handleProcessImage} isLoading={isProcessing} />
        ) : (
          <div className={`editor-layout ${isComparing ? 'compare-mode' : ''}`}>
            <div className="editor-workspace">
              <EditorCanvas
                image={currentImage}
                redactions={redactions}
                selectedId={selectedId}
                onSelectRedaction={setSelectedId}
                onAddManualRedaction={handleAddManualRedaction}
                onUpdateRedactionBbox={handleUpdateRedactionBbox}
                onOpenDebug={handleOpenDebug}
                hasDebugData={debugData !== null}
                compareMode={isComparing}
                comparePosition={comparePosition}
                onCompareModeChange={handleCompareModeChange}
                onComparePositionChange={setComparePosition}
              />
            </div>

            <EntitySidebar
              redactions={redactions}
              selectedId={selectedId}
              onSelectRedaction={setSelectedId}
              onToggleRedaction={handleToggleRedaction}
              onChangeStyle={handleChangeStyle}
              onDeleteRedaction={handleDeleteRedaction}
              onBatchToggleAll={handleBatchToggleAll}
              onBatchSetStyle={handleBatchSetStyle}
              padding={padding}
              onPaddingChange={handlePaddingChange}
              onExport={handleOpenExport}
            />
          </div>
        )}
      </main>

      {isExportOpen && currentImage && (
        <ExportPanel
          image={currentImage}
          redactions={redactions}
          isDetectionDegraded={isDetectionDegraded}
          onClose={handleCloseExport}
        />
      )}

      {isDebugOpen && debugData && (
        <DetectionDebugModal data={debugData} onClose={() => setIsDebugOpen(false)} />
      )}
    </div>
  );
};
