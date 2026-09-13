import React from "react";
import { X } from "lucide-react";

interface ProcessingScannerProps {
  image: HTMLImageElement;
  title: string;
  subtitle: string;
  progress: number;
  phase: string;
  onCancel: () => void;
}

const PROCESSING_STAGES = [
  { label: "Read Image", phases: ["loading-image"] },
  { label: "Detect Text", phases: ["loading-ocr-model", "running-ocr"] },
  {
    label: "Find Sensitive Data",
    phases: ["loading-privacy-filter", "detecting-sensitive-data"],
  },
  { label: "Build Preview", phases: ["rendering-preview", "ready"] },
] as const;

export const ProcessingScanner: React.FC<ProcessingScannerProps> = ({
  image,
  title,
  subtitle,
  progress,
  phase,
  onCancel,
}) => {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  const activeStage = Math.max(
    0,
    PROCESSING_STAGES.findIndex((stage) =>
      stage.phases.some((stagePhase) => stagePhase === phase),
    ),
  );

  return (
    <section
      className="processing-scanner"
      aria-labelledby="processing-title"
      aria-describedby="processing-status"
      aria-busy="true"
    >
      <ol
        className="processing-stage-strip"
        aria-label="Image processing stages"
      >
        {PROCESSING_STAGES.map((stage, index) => (
          <li
            key={stage.label}
            className={
              index < activeStage
                ? "complete"
                : index === activeStage
                  ? "active"
                  : ""
            }
            aria-current={index === activeStage ? "step" : undefined}
          >
            <span>{index < activeStage ? "✓" : index + 1}</span>
            {stage.label}
          </li>
        ))}
      </ol>
      <div className="processing-scan-stage">
        <img
          className="processing-scan-image"
          src={image.src}
          width={width}
          height={height}
          alt="Screenshot being analyzed"
        />
        <div className="processing-scan-shade" aria-hidden="true" />
        <div className="processing-laser-track" aria-hidden="true">
          <div className="processing-laser-sweep" />
        </div>
        <div className="processing-scan-grid" aria-hidden="true" />
      </div>

      <div className="processing-scan-status" role="status" aria-live="polite">
        <div className="processing-scan-copy">
          <strong id="processing-title">{title}</strong>
          <span id="processing-status">{subtitle}</span>
        </div>

        <div
          className="processing-scan-progress"
          role="progressbar"
          aria-label="Image processing progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(normalizedProgress)}
          aria-valuetext={`${phase}: ${Math.round(normalizedProgress)}%`}
        >
          <span style={{ transform: `scaleX(${normalizedProgress / 100})` }} />
        </div>

        <span className="processing-scan-percent">
          {Math.round(normalizedProgress)}%
        </span>
        <button
          type="button"
          className="toolbar-btn processing-cancel-btn"
          onClick={onCancel}
          aria-label="Cancel image processing"
          title="Cancel processing"
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};
