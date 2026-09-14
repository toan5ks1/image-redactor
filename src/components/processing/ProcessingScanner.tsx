import React from "react";

interface ProcessingScannerProps {
  image: HTMLImageElement;
  title: string;
  subtitle: string;
  progress: number;
  phase: string;
}

const PROCESSING_STAGES = [
  { label: "Read Image", phases: ["loading-image"] },
  { label: "Detect Text", phases: ["loading-ocr-model", "running-ocr"] },
  {
    label: "Find Sensitive Data",
    phases: ["loading-privacy-filter", "detecting-sensitive-data"],
  },
  { label: "Prepare Editor", phases: ["preparing-editor", "ready"] },
] as const;

const STAGE_PROGRESS_RANGES = [
  [0, 15],
  [15, 60],
  [60, 98],
  [98, 100],
] as const;

export const ProcessingScanner: React.FC<ProcessingScannerProps> = ({
  image,
  title,
  subtitle,
  progress,
  phase,
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
      aria-label="Processing screenshot"
      aria-describedby="processing-status"
      aria-busy="true"
    >
      <div className="processing-progress-shell">
        <ol
          className="processing-stage-strip"
          aria-label="Image processing stages"
        >
          {PROCESSING_STAGES.map((stage, index) => {
            const isActive = index === activeStage;
            const [stageStart, stageEnd] = STAGE_PROGRESS_RANGES[index];
            const segmentProgress =
              index < activeStage
                ? 1
                : index > activeStage
                  ? 0
                  : Math.min(
                      1,
                      Math.max(
                        0,
                        (normalizedProgress - stageStart) / (stageEnd - stageStart),
                      ),
                    );

            return (
              <li
                key={stage.label}
                className={
                  index < activeStage
                    ? "complete"
                    : isActive
                      ? "active"
                      : ""
                }
                style={{ "--stage-progress": segmentProgress } as React.CSSProperties}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={`processing-stage-marker${isActive ? " has-progress" : ""}`}
                  style={
                    isActive
                      ? ({
                          "--ring-progress": `${normalizedProgress * 3.6}deg`,
                        } as React.CSSProperties)
                      : undefined
                  }
                  role={isActive ? "progressbar" : undefined}
                  aria-label={isActive ? `${stage.label} progress` : undefined}
                  aria-valuemin={isActive ? 0 : undefined}
                  aria-valuemax={isActive ? 100 : undefined}
                  aria-valuenow={isActive ? Math.round(normalizedProgress) : undefined}
                  aria-valuetext={
                    isActive
                      ? `${title}: ${Math.round(normalizedProgress)}%`
                      : undefined
                  }
                  aria-hidden={isActive ? undefined : true}
                >
                  <span className="processing-stage-marker-value">
                    {index < activeStage
                      ? "✓"
                      : isActive
                        ? `${Math.round(normalizedProgress)}%`
                        : index + 1}
                  </span>
                </span>
                <span className="processing-stage-copy">
                  <span className="processing-stage-label">{stage.label}</span>
                </span>
              </li>
            );
          })}
        </ol>

      </div>

      <p id="processing-status" className="sr-only" role="status" aria-live="polite">
        {title}. {subtitle} {Math.round(normalizedProgress)}% complete.
      </p>

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

    </section>
  );
};
