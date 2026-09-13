import React from "react";
import { Shield, Lock, Undo2, Redo2, ImagePlus } from "lucide-react";

interface HeaderProps {
  hasImage: boolean;
  isEditing: boolean;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  hasImage,
  isEditing,
  onReset,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo" aria-hidden="true">
          <Shield size={20} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="brand-title">Privacy Redactor</span>
            <span className="brand-badge">
              <Lock
                size={10}
                style={{ display: "inline", marginRight: "3px" }}
                aria-hidden="true"
              />
              100% LOCAL
            </span>
          </div>
        </div>
      </div>

      <div className="header-actions">
        {hasImage && isEditing && (
          <div
            className="header-history-actions"
            aria-label="Edit history controls"
          >
            <button
              type="button"
              className="toolbar-btn"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z / ⌘Z)"
              aria-label="Undo last redaction edit"
            >
              <Undo2 size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z / ⌘⇧Z)"
              aria-label="Redo last redaction edit"
            >
              <Redo2 size={15} aria-hidden="true" />
            </button>
          </div>
        )}

        {hasImage && (
          <>
            <button
              type="button"
              className="new-image-btn"
              onClick={() => {
                if (window.confirm("Start a new image? Your current redaction edits will be cleared.")) {
                  onReset();
                }
              }}
              aria-label="Start over with a new image"
            >
              <ImagePlus size={15} aria-hidden="true" />
              New Image
            </button>
          </>
        )}

        {/* <div className="mode-selector">
          <button
            className={`mode-btn ${mode === 'local' ? 'active' : ''}`}
            onClick={() => onModeChange('local')}
            title="Processes everything locally on this device"
            aria-pressed={mode === 'local'}
          >
            <CloudOff size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
            Local Mode
          </button>
          <button
            className="mode-btn disabled"
            disabled
            title="Remote Unlimited-OCR engine (Planned for Phase 2)"
          >
            Remote (Phase 2)
          </button>
        </div> */}

        {/* <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="toolbar-btn"
          title="About Privacy Screenshot Redactor"
          aria-label="About Privacy Screenshot Redactor"
          style={{ textDecoration: "none" }}
        >
          <Info size={16} />
        </a> */}
      </div>
    </header>
  );
};
