import React, { useMemo, useState } from "react";
import {
  Trash2,
  Eye,
  EyeOff,
  Download,
  Sliders,
  ListChecks,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Redaction, RedactionStyle } from "../../domain/redaction";
import { EntityCategory } from "../../domain/sensitive-entity";
import { CATEGORY_CONFIG } from "../../shared/constants/categories";

const CATEGORY_ORDER: EntityCategory[] = [
  "secret",
  "password",
  "person",
  "email",
  "phone",
  "address",
  "account",
  "url",
  "date",
  "custom",
];

interface EntitySidebarProps {
  redactions: Redaction[];
  selectedId: string | null;
  onSelectRedaction: (id: string | null) => void;
  onToggleRedaction: (id: string) => void;
  onChangeStyle: (id: string, style: RedactionStyle) => void;
  onDeleteRedaction: (id: string) => void;
  onBatchToggleAll: (enable: boolean) => void;
  onBatchSetStyle: (style: RedactionStyle) => void;
  padding: number;
  onPaddingChange: (padding: number) => void;
  onExport: () => void;
}

export const EntitySidebar: React.FC<EntitySidebarProps> = ({
  redactions,
  selectedId,
  onSelectRedaction,
  onToggleRedaction,
  onChangeStyle,
  onDeleteRedaction,
  onBatchToggleAll,
  onBatchSetStyle,
  padding,
  onPaddingChange,
  onExport,
}) => {
  const [filterCategory, setFilterCategory] = useState<EntityCategory | "all">("all");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { categoryCounts, enabledCount } = useMemo(() => {
    const counts = new Map<EntityCategory, number>();
    let enabled = 0;

    for (const redaction of redactions) {
      counts.set(redaction.category, (counts.get(redaction.category) || 0) + 1);
      if (redaction.enabled) enabled += 1;
    }

    return { categoryCounts: counts, enabledCount: enabled };
  }, [redactions]);

  const presentCategories = useMemo(
    () => CATEGORY_ORDER.filter((category) => categoryCounts.has(category)),
    [categoryCounts],
  );
  const activeCategory =
    filterCategory === "all" || categoryCounts.has(filterCategory) ? filterCategory : "all";
  const filteredRedactions = useMemo(
    () =>
      activeCategory === "all"
        ? redactions
        : redactions.filter((redaction) => redaction.category === activeCategory),
    [activeCategory, redactions],
  );
  const disabledCount = redactions.length - enabledCount;
  const sharedStyle =
    redactions.length > 0 && redactions.every((redaction) => redaction.style === redactions[0].style)
      ? redactions[0].style
      : null;

  if (isCollapsed) {
    return (
      <aside className="editor-sidebar is-collapsed" aria-label="Detected sensitive items">
        <div className="sidebar-collapsed-rail">
          <button
            type="button"
            className="toolbar-btn sidebar-toggle-btn"
            onClick={() => setIsCollapsed(false)}
            aria-label="Expand detected items sidebar"
            aria-expanded="false"
            aria-controls="detected-items-panel"
            title="Expand detected items"
          >
            <PanelRightOpen size={18} aria-hidden="true" />
          </button>
          <span className="sidebar-count" title={`${enabledCount} active redactions`}>
            {enabledCount}
          </span>
        </div>
        <div id="detected-items-panel" hidden />
      </aside>
    );
  }

  return (
    <aside className="editor-sidebar" aria-label="Sensitive information findings">
      <div className="sidebar-section-header">
        <div>
          <div className="sidebar-title">
            <ListChecks size={16} aria-hidden="true" />
            <span>Findings</span>
          </div>
          <p className="sidebar-subtitle">Review what the scanner found</p>
        </div>
        <button
          type="button"
          className="toolbar-btn sidebar-toggle-btn"
          onClick={() => setIsCollapsed(true)}
          aria-label="Collapse detected items sidebar"
          aria-expanded="true"
          aria-controls="detected-items-panel"
          title="Collapse detected items"
        >
          <PanelRightClose size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="sidebar-content" id="detected-items-panel">
        <div className="findings-summary" aria-label="Findings summary">
          <div className="findings-summary-copy">
            <span className={disabledCount > 0 ? "findings-status-dot warning" : "findings-status-dot"} />
            <strong>{redactions.length} findings</strong>
            <span aria-hidden="true">·</span>
            <span>
              {disabledCount > 0
                ? `${enabledCount} protected, ${disabledCount} disabled`
                : "All protected"}
            </span>
          </div>
          {disabledCount > 0 ? (
            <button type="button" onClick={() => onBatchToggleAll(true)}>
              Protect All
            </button>
          ) : null}
        </div>

        <div className="sidebar-global-controls">
          <div className="sidebar-control-head">
            <span>Mask All With</span>
          </div>

          <div className="style-selector">
            {(["blur", "pixelate", "mask"] as RedactionStyle[]).map((style) => (
              <button
                type="button"
                key={style}
                className={`style-btn ${sharedStyle === style ? "active" : ""}`}
                onClick={() => onBatchSetStyle(style)}
                aria-pressed={sharedStyle === style}
              >
                <span>{style}</span>
              </button>
            ))}
          </div>

          <div className="padding-control">
            <div className="padding-label-row">
              <label htmlFor="redaction-padding">
                <Sliders size={12} aria-hidden="true" /> Bounding Box Padding
              </label>
              <output htmlFor="redaction-padding">
                {padding}px
              </output>
            </div>
            <input
              id="redaction-padding"
              type="range"
              min="0"
              max="16"
              step="1"
              value={padding}
              name="redaction-padding"
              onChange={(e) => onPaddingChange(Number(e.target.value))}
              aria-label="Automatic redaction padding in pixels"
            />
          </div>
        </div>

        {/* Category Filters */}
        {presentCategories.length > 1 && (
          <div
            className="category-filters"
            role="group"
            aria-label="Filter sensitive items by category"
          >
            <button
              type="button"
              className={`category-filter-btn ${activeCategory === "all" ? "active" : ""}`}
              onClick={() => setFilterCategory("all")}
              aria-pressed={activeCategory === "all"}
            >
              All ({redactions.length})
            </button>
            {presentCategories.map((cat) => {
              const meta = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.custom;
              const count = categoryCounts.get(cat) || 0;
              const isActive = activeCategory === cat;
              return (
                <button
                  type="button"
                  key={cat}
                  className={`category-filter-btn ${isActive ? "active" : ""}`}
                  onClick={() => setFilterCategory(cat)}
                  aria-pressed={isActive}
                  style={
                    isActive
                      ? {
                          background: meta.bgColor,
                          color: meta.color,
                          borderColor: meta.borderColor,
                        }
                      : undefined
                  }
                >
                  {meta.short} ({count})
                </button>
              );
            })}
          </div>
        )}

        <div className="entity-list" aria-live="polite">
          {filteredRedactions.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "32px 16px",
                color: "var(--text-muted)",
              }}
            >
              No sensitive items detected or matched filter.
            </div>
          ) : (
            filteredRedactions.map((item) => {
              const meta =
                CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.custom;
              const isSelected = item.id === selectedId;

              return (
                <article
                  key={item.id}
                  className={`entity-card ${isSelected ? "selected" : ""} ${
                    !item.enabled ? "disabled" : ""
                  }`}
                >
                  <div className="entity-head">
                    <button
                      type="button"
                      className="entity-select-btn"
                      onClick={() => onSelectRedaction(item.id)}
                      aria-pressed={isSelected}
                      aria-label={`Select ${meta.label}: ${item.enabled ? "enabled" : "disabled"}`}
                    >
                      <span className="entity-row-copy">
                        <span
                          className="entity-badge"
                          style={{
                            background: meta.bgColor,
                            color: meta.color,
                            border: `1px solid ${meta.borderColor}`,
                          }}
                        >
                          {meta.label}
                        </span>
                        <span className="entity-snippet" title={item.value || item.label}>
                          {item.value || item.label}
                        </span>
                        <span className="entity-source">{formatMatchSource(item)}</span>
                      </span>
                    </button>

                    <div className="entity-actions">
                      <button
                        type="button"
                        className="toolbar-btn entity-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleRedaction(item.id);
                        }}
                        title={
                          item.enabled
                            ? "Disable Redaction"
                            : "Enable Redaction"
                        }
                        aria-label={
                          item.enabled
                            ? "Disable redaction"
                            : "Enable redaction"
                        }
                      >
                        {item.enabled ? (
                          <Eye size={13} color="var(--accent-cyan)" aria-hidden="true" />
                        ) : (
                          <EyeOff size={13} color="var(--text-muted)" aria-hidden="true" />
                        )}
                      </button>

                      <button
                        type="button"
                        className="toolbar-btn entity-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRedaction(item.id);
                        }}
                        title="Remove Redaction"
                        aria-label="Remove redaction"
                      >
                        <Trash2 size={13} color="var(--accent-rose)" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="entity-inspector">
                      <label>
                        Mask Style
                        <select
                          value={item.style}
                          aria-label={`Redaction style for ${meta.label}`}
                          name={`redaction-style-${item.id}`}
                          onChange={(e) => onChangeStyle(item.id, e.target.value as RedactionStyle)}
                        >
                          <option value="mask">Solid Mask</option>
                          <option value="pixelate">Pixelate</option>
                          <option value="blur">Blur</option>
                        </select>
                      </label>
                      <span>
                        {Math.round(item.bbox[2] - item.bbox[0])} ×{" "}
                        {Math.round(item.bbox[3] - item.bbox[1])}&nbsp;px
                      </span>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          className="primary-btn"
          onClick={onExport}
          disabled={enabledCount === 0}
        >
          <span>Export Image</span>
          <Download size={16} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
};

function formatMatchSource(redaction: Redaction): string {
  const matchedBy = redaction.matchedBy || [];
  if (redaction.source === "manual" || matchedBy.includes("manual")) {
    return "Manual box";
  }

  const hasAI = matchedBy.includes("privacy-filter");
  const hasRule = matchedBy.includes("rules");
  if (hasAI && hasRule) return "AI + Rule match";
  if (hasAI) return "AI match";
  if (hasRule) return "Rule match";
  return "Source unavailable";
}
