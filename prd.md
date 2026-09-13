# PRD — Privacy Screenshot Redactor

**Status:** Draft
**Version:** 0.1
**Product:** Privacy Screenshot Redactor
**Target:** Local-first web application
**Scope:** MVP v1

---

## 1. Overview

### 1.1 Problem statement

Developers, QA engineers, product teams and general users frequently share screenshots through Slack, Jira, documentation, issue trackers and AI tools.

These screenshots may contain sensitive information such as:

- Email addresses and phone numbers.
- Personal names and account identifiers.
- API keys, access tokens and JWTs.
- Passwords and authentication-related information.
- Bank account information.
- Other personally identifiable or confidential business information.

Manually finding and hiding these details is time-consuming and error-prone.

Existing screenshot tools typically provide manual blur or masking, but do not automatically understand which text is sensitive and where it appears in the image.

### 1.2 Product vision

Build a simple tool that allows users to upload a screenshot and automatically produce a redacted version without manually searching for sensitive information.

**Core value proposition:**

> Upload a screenshot. Detect sensitive text. Review the redactions. Export a safer image.

### 1.3 Product principles

1. **Privacy-first:** Local mode should process the original image on the user's device.
2. **User control:** The user must be able to review, remove or add redactions before export.
3. **Deterministic rendering:** Redaction must be applied to the actual image coordinates returned by OCR.
4. **Simple UX:** The user should not need to configure AI models or understand OCR.
5. **Extensible architecture:** Local and Remote modes should share a common OCR and redaction contract.

---

## 2. Goals and non-goals

### 2.1 Goals

#### Primary goals

- Allow users to upload or paste a screenshot.
- Extract text and bounding boxes using a local OCR engine.
- Detect sensitive text using a local Privacy Filter ONNX model.
- Automatically map sensitive entities to their original image locations.
- Render redactions on the screenshot.
- Provide a before/after preview.
- Allow users to adjust redactions manually.
- Export a redacted PNG image.
- Ensure the MVP works without uploading the original image to a remote server.

#### Secondary goals

- Support common developer screenshots, including logs, code blocks and API responses.
- Support multiple redaction styles.
- Provide a clear indication of processing status.
- Keep the OCR engine replaceable for future Remote mode.
- Prepare the application architecture for a future MCP server.

### 2.2 Non-goals

The following are explicitly out of scope for MVP v1:

- Remote OCR using Unlimited-OCR.
- MCP server implementation.
- Cloud storage or user accounts.
- Multi-user collaboration.
- Video redaction.
- Full PDF document redaction.
- Guaranteed detection of every possible sensitive information type.
- Automated publishing to Slack, Jira or other external platforms.
- Training a custom OCR or privacy model.
- Full desktop application packaging.

---

## 3. Target users

### Primary persona — Developer / Engineer

**Example:** A frontend engineer wants to share a screenshot of an API response, error log or bank application UI.

**Pain points:**

- Screenshots contain API keys, email addresses or account information.
- Manually masking sensitive text takes time.
- They may accidentally miss a sensitive field.
- They want a fast workflow without uploading confidential screenshots to a third-party service.

**Desired outcome:**

Upload screenshot → review detected redactions → export → share.

### Secondary persona — QA / Product / Support

Uses screenshots from staging or production environments and needs to hide personal or business-sensitive information before sharing them.

---

## 4. User experience

### 4.1 Primary user journey

1. User opens the application.
2. User selects Local mode.
3. User uploads a PNG/JPG screenshot or pastes an image.
4. Application performs OCR locally.
5. Application detects sensitive text locally.
6. Application overlays redaction regions.
7. User reviews the result.
8. User edits redactions if necessary.
9. User exports the redacted image.

### 4.2 User flow

```text
Open App
   ↓
Select Local Mode
   ↓
Upload / Paste Screenshot
   ↓
OCR Processing
   ↓
Sensitive Content Detection
   ↓
Generate Redaction Preview
   ↓
User Review
   ├── Accept
   ├── Remove Redaction
   ├── Add Manual Redaction
   └── Change Redaction Style
   ↓
Export Redacted Image
```

### 4.3 UX requirements

- The main workflow should be accessible from the landing screen.
- The user should not need to configure model settings for normal use.
- The UI must display processing progress.
- The application must clearly distinguish:
  - Original image.
  - Detected sensitive regions.
  - Final redacted image.

- The user must be able to undo or remove an automatically detected redaction.
- The user must be able to manually add a redaction.
- The application must not overwrite the original file.

---

## 5. Functional requirements

### FR-001 — Mode selection

**Priority:** Must have

The application shall support a mode selector.

MVP shall expose:

- Local mode — available.
- Remote mode — planned / disabled in MVP.

Local mode shall be the default.

The architecture must allow a future Remote OCR engine without requiring changes to the core redaction UI.

### FR-002 — Image input

**Priority:** Must have

The application shall support:

- Upload PNG.
- Upload JPG/JPEG.
- Paste image from clipboard, where supported.
- Drag and drop image, where supported.

Requirements:

- Validate supported file types.
- Display a useful error for unsupported files.
- Display a useful error for corrupted images.
- Preserve the original image dimensions.
- Do not overwrite the original file.

MVP image limit:

- Maximum file size: 20 MB.
- Maximum image dimension: 10,000 × 10,000 pixels.

These limits are initial product assumptions and should be adjusted based on browser performance testing.

### FR-003 — Local OCR

**Priority:** Must have

The application shall run OCR using a local-compatible OCR engine.

The OCR engine must provide:

- Recognized text.
- Bounding box coordinates.
- Image dimensions or enough information to normalize coordinates.
- Stable mapping between recognized text segments and their bounding boxes.

Preferred output granularity:

- Word-level bounding boxes where available.
- Line-level bounding boxes as a fallback.

The application shall normalize OCR output into a shared internal schema.

Example:

```typescript
type OCRResult = {
  imageWidth: number;
  imageHeight: number;
  lines: OCRLine[];
};

type OCRLine = {
  id: string;
  text: string;
  bbox: [number, number, number, number];
  words?: OCRWord[];
};
```

The OCR engine must be replaceable through an interface.

Example:

```typescript
interface OCREngine {
  recognize(image: Blob): Promise<OCRResult>;
}
```

### FR-004 — Local Privacy Filter

**Priority:** Must have

The application shall use a local ONNX Privacy Filter model through Transformers.js or a compatible local inference runtime.

The model shall receive OCR text, not the original screenshot.

The model shall identify potentially sensitive entities.

Initial categories:

- Email.
- Phone number.
- Personal name.
- API key.
- Access token.
- JWT.
- Password.
- Bank account number.
- Customer/account identifier.
- Address.
- Other supported PII categories defined by the model.

The detection layer shall support structured output.

Example:

```typescript
type SensitiveEntity = {
  id: string;
  category: string;
  confidence?: number;
};
```

The model must not be assumed to detect every sensitive entity.

### FR-005 — Deterministic sensitive-data detection

**Priority:** Must have

The application shall support deterministic rules in addition to the Privacy Filter.

Initial rules may include:

- Email regex.
- Phone number regex.
- JWT pattern.
- Known API key prefixes.
- Token-like strings.
- Other high-confidence secret patterns.

The deterministic detector shall run alongside the Privacy Filter.

If a deterministic rule identifies a high-confidence secret, the application shall be able to mark it for redaction independently of the LLM/model output.

### FR-006 — Text-to-bounding-box mapping

**Priority:** Must have

The application shall map detected sensitive text to the corresponding OCR text segments.

Requirements:

- Each OCR segment shall have a stable ID.
- The Privacy Filter result shall reference the OCR segment ID or a deterministic mapping.
- The application shall not rely solely on exact string matching.
- The application shall handle common whitespace and line-break normalization.
- The application shall handle multiple occurrences of the same text.
- The application shall support line-level and word-level redaction.

The preferred approach is ID-based mapping:

```text
OCR segment ID
   ↓
Privacy Filter result
   ↓
Original bounding box
   ↓
Redaction region
```

### FR-007 — Redaction rendering

**Priority:** Must have

The application shall render a redaction overlay on the original image.

Supported MVP styles:

1. Blur.
2. Pixelate.
3. Solid mask.

The application shall support configurable padding around detected bounding boxes.

Example:

```typescript
type RedactionStyle = "blur" | "pixelate" | "mask";

type Redaction = {
  id: string;
  bbox: [number, number, number, number];
  category: string;
  style: RedactionStyle;
  source: "automatic" | "manual";
};
```

The rendering engine shall:

- Preserve image dimensions.
- Support multiple redaction regions.
- Support overlapping regions.
- Prevent redaction regions from exceeding image boundaries.
- Render consistently in preview and export.

### FR-008 — User review

**Priority:** Must have

The user shall be able to review all detected redactions before export.

The review UI shall support:

- Highlight detected regions.
- Show the redaction category.
- Remove a redaction.
- Add a manual redaction.
- Change redaction style.
- Change padding.
- Undo/redo edits.

The user shall be able to zoom and pan the image.

### FR-009 — Manual redaction

**Priority:** Must have

The user shall be able to draw a rectangle over any region of the image.

Manual redactions shall:

- Be visually distinguishable from automatic redactions during review.
- Support the same redaction styles.
- Be included in the exported image.
- Not require OCR or model detection.

### FR-010 — Export

**Priority:** Must have

The application shall allow the user to export the final image.

MVP export:

- PNG.
- Preserve original image dimensions.
- Apply all accepted automatic and manual redactions.
- Do not include editable redaction overlays in the exported image.
- Do not modify the original image file.

The application should strip unnecessary metadata where technically feasible.

### FR-011 — Error handling

**Priority:** Must have

The application shall display useful errors for:

- Unsupported file format.
- File too large.
- Image decoding failure.
- OCR initialization failure.
- OCR processing failure.
- Privacy Filter initialization failure.
- Privacy Filter inference failure.
- Browser memory limitations.
- Export failure.

The application shall not silently produce an image that appears successfully redacted when a required processing step failed.

### FR-012 — Processing state

**Priority:** Must have

The application shall show processing states:

- Idle.
- Loading OCR model.
- Running OCR.
- Loading Privacy Filter.
- Detecting sensitive information.
- Rendering preview.
- Ready for review.
- Exporting.
- Failed.

The application should distinguish model initialization from image processing.

---

## 6. Privacy and security requirements

### PR-001 — Local image processing

In Local mode, the original screenshot shall remain on the user's device during normal processing.

The application shall not upload the original screenshot to a remote server.

### PR-002 — No raw image logging

The application shall not log:

- Original image content.
- Base64 image data.
- OCR text containing sensitive information.
- Access tokens or passwords.

Development logging shall use sanitized metadata only.

### PR-003 — No persistent storage by default

The application shall not persist original images or redacted images unless the user explicitly saves or exports them.

Temporary in-memory data should be released after processing where practical.

### PR-004 — Model loading

The application shall clearly indicate when models are downloaded or initialized.

The application should support cached model assets where appropriate, but must not assume that browser cache is a security boundary.

### PR-005 — Redaction safety

The application shall not claim that an image is guaranteed safe.

The product shall communicate that automatic detection may miss sensitive information.

For high-risk secrets such as API keys and passwords, the default rendering style should be solid mask or another opaque redaction.

### PR-006 — User confirmation

The user must review the result before export.

The application shall make it easy to add manual redactions.

### PR-007 — Export privacy

The export pipeline should remove unnecessary metadata where feasible.

The product should avoid retaining image history by default.

---

## 7. Technical architecture

### 7.1 High-level architecture

```text
React Application
      │
      ├── Image Input
      │
      ├── Local OCR Engine
      │       └── OCRResult
      │
      ├── Privacy Detection Pipeline
      │       ├── Deterministic Rules
      │       └── Privacy Filter ONNX
      │
      ├── Entity Mapping
      │       └── OCR IDs → Bounding Boxes
      │
      ├── Redaction State
      │
      ├── Canvas Renderer
      │
      └── Export PNG
```

### 7.2 Suggested frontend stack

- React.
- TypeScript.
- Vite.
- Transformers.js.
- ONNX Runtime through the selected local inference runtime.
- Canvas API or Konva.js for image editing.
- Web Worker for inference where practical.

The exact OCR engine is a technical spike decision and is not fixed by this PRD.

### 7.3 Core domain modules

```text
src/
├── app/
│   ├── App.tsx
│   └── routes/
│
├── features/
│   ├── image-input/
│   ├── ocr/
│   ├── privacy-detection/
│   ├── redaction/
│   ├── image-editor/
│   └── export/
│
├── engines/
│   ├── ocr/
│   │   ├── OCREngine.ts
│   │   ├── LocalOCREngine.ts
│   │   └── RemoteOCREngine.ts
│   │
│   └── privacy/
│       ├── PrivacyDetector.ts
│       ├── ONNXPrivacyDetector.ts
│       └── RulesDetector.ts
│
├── domain/
│   ├── ocr.ts
│   ├── sensitive-entity.ts
│   └── redaction.ts
│
├── shared/
│   ├── image/
│   ├── utils/
│   └── types/
│
└── workers/
    ├── ocr.worker.ts
    └── privacy.worker.ts
```

### 7.4 Engine abstraction

The application shall define an OCR engine interface so that local and remote engines return the same normalized result.

```typescript
interface OCREngine {
  recognize(image: Blob): Promise<OCRResult>;
}
```

Future remote implementation:

```typescript
class RemoteOCREngine implements OCREngine {
  async recognize(image: Blob): Promise<OCRResult> {
    // Future Unlimited-OCR API integration
  }
}
```

The redaction engine shall not depend directly on Unlimited-OCR.

---

## 8. Data contracts

### 8.1 OCRResult

```typescript
type BBox = [number, number, number, number];

type OCRWord = {
  id: string;
  text: string;
  bbox: BBox;
  confidence?: number;
};

type OCRLine = {
  id: string;
  text: string;
  bbox: BBox;
  words?: OCRWord[];
};

type OCRResult = {
  imageWidth: number;
  imageHeight: number;
  lines: OCRLine[];
};
```

### 8.2 Sensitive detection result

```typescript
type SensitiveEntity = {
  id: string;
  category: string;
  confidence?: number;
  detector: "privacy-filter" | "rules";
};
```

### 8.3 Redaction state

```typescript
type Redaction = {
  id: string;
  bbox: BBox;
  category?: string;
  style: "blur" | "pixelate" | "mask";
  source: "automatic" | "manual";
  enabled: boolean;
};
```

### 8.4 Important mapping rule

The application shall preserve the relationship:

```text
OCRLine.id
   ↓
SensitiveEntity.id
   ↓
Redaction.bbox
```

The Privacy Filter should not be responsible for inventing image coordinates.

---

## 9. MVP UI requirements

### 9.1 Landing screen

Must contain:

- Product name.
- Short privacy-first description.
- Local mode indicator.
- Upload button.
- Drag-and-drop area.
- Paste screenshot action where supported.

### 9.2 Processing screen

Must contain:

- Image preview or placeholder.
- Current processing step.
- Progress indicator.
- Cancel action if feasible.
- Error state.

### 9.3 Editor screen

Must contain:

- Screenshot canvas.
- Redaction overlays.
- Zoom controls.
- Pan controls.
- Redaction style selector.
- List of detected sensitive entities.
- Add manual redaction.
- Remove/undo redaction.
- Export button.

### 9.4 Export result

Must contain:

- Final image preview.
- Export PNG action.
- Start over action.

---

## 10. Non-functional requirements

### NFR-001 — Performance

Initial targets for a typical developer screenshot:

- OCR + detection completes within 10 seconds on a supported modern laptop, excluding first-time model download.
- UI remains responsive during inference where practical.
- Image preview renders without visible layout shift.
- Export completes within 3 seconds for typical screenshots.

These are targets for validation, not guaranteed performance.

### NFR-002 — Browser support

Target:

- Latest Chrome.
- Latest Edge.
- Latest Firefox, subject to local inference compatibility.

Safari support is a later validation item.

### NFR-003 — Memory

The application should avoid unnecessary duplication of large image buffers.

Model initialization and inference should be moved to Web Workers where practical.

### NFR-004 — Reliability

- Failed OCR must not produce misleading redaction output.
- Failed Privacy Filter initialization must be visible to the user.
- Export must include all enabled redactions.
- The application must preserve the original image until the user completes export.

### NFR-005 — Accessibility

- Keyboard-accessible controls.
- Visible focus states.
- Meaningful button labels.
- Sufficient contrast.
- Screen-reader-friendly processing status.
- Non-hover-dependent controls.

---

## 11. Acceptance criteria

### AC-001 — Basic local flow

Given a supported PNG screenshot, when the user uploads it in Local mode, the application shall process the image without uploading the original image to a remote server.

### AC-002 — OCR

Given an image containing readable text, the OCR engine shall return text segments with valid bounding boxes.

### AC-003 — Sensitive detection

Given OCR text containing an email address or API key, the application shall identify the entity using the Privacy Filter or deterministic rules.

### AC-004 — Correct positioning

Given a detected sensitive entity, the application shall render a redaction over the corresponding original image region.

### AC-005 — Review

Given an automatically detected redaction, the user shall be able to remove it before export.

### AC-006 — Manual redaction

Given an arbitrary region of the screenshot, the user shall be able to add a manual redaction.

### AC-007 — Export

Given a set of accepted redactions, the exported PNG shall contain the redactions and preserve the original image dimensions.

### AC-008 — Failure handling

Given an OCR or Privacy Filter failure, the application shall show a clear error and shall not silently claim the screenshot is safe.

### AC-009 — No accidental upload

Given Local mode, network inspection shall show no upload of the original screenshot to a remote backend during OCR, detection or export.

### AC-010 — No raw sensitive logging

Given an image containing sensitive text, application logs shall not contain the original image, raw OCR text or detected secrets.

---

## 12. Technical spike / open questions

### Spike 1 — Local OCR engine

**Goal:** Identify a browser-compatible OCR engine that returns reliable bounding boxes.

Evaluate:

- ONNX / WebGPU / WASM compatibility.
- OCR accuracy on screenshots.
- Word-level versus line-level bounding boxes.
- English and Vietnamese support.
- Model size.
- Cold-start time.
- Inference time.
- Memory consumption.
- License.

**Decision required before implementation:** Select the local OCR engine.

### Spike 2 — Privacy Filter ONNX

**Goal:** Validate the existing ONNX + Transformers.js integration.

Evaluate:

- Browser compatibility.
- Model loading time.
- Inference time.
- Supported sensitive entity categories.
- Structured output reliability.
- Memory usage.
- Offline execution after model assets are available.

### Spike 3 — Text-to-box mapping

**Goal:** Verify that OCR output can be mapped reliably to sensitive entities.

Test:

- Duplicate text.
- Whitespace differences.
- Line breaks.
- Punctuation.
- Partial text detection.
- Multiple sensitive entities in one line.

### Spike 4 — Redaction quality

**Goal:** Validate that redactions cover sensitive content without excessive coverage.

Test:

- Single-line email.
- API keys.
- JWT.
- Multiline text.
- Small fonts.
- Dark mode screenshots.
- Dense code blocks.
- Retina screenshots.

### Spike 5 — Browser performance

**Goal:** Establish practical image size and model constraints.

Measure:

- OCR latency.
- Privacy Filter latency.
- Total processing time.
- Peak memory.
- Browser crashes / OOM.
- Worker responsiveness.

---

## 13. Roadmap

### Phase 0 — Technical spike

- Select local OCR engine.
- Validate OCR bounding boxes.
- Validate Privacy Filter ONNX.
- Build proof-of-concept pipeline.
- Validate redaction rendering.

**Deliverable:** Local pipeline successfully redacts a sample screenshot.

### Phase 1 — Local MVP

- Upload / paste image.
- Local OCR.
- Local Privacy Filter.
- Automatic redaction.
- Manual redaction.
- Preview.
- Export PNG.
- Error handling.
- Privacy safeguards.

**Deliverable:** Usable local-first web app.

### Phase 2 — Remote mode

- Add Remote OCR engine.
- Integrate Unlimited-OCR server.
- Add remote mode UI.
- Preserve shared OCR and redaction contract.
- Add server-side security controls.

**Deliverable:** Same app can run local or remote inference.

### Phase 3 — MCP server

- Expose redaction pipeline as an MCP tool.
- Support image input/output.
- Add authentication and rate limits.
- Add file size limits and cleanup.
- Add integration documentation.

**Deliverable:** AI agents can call screenshot redaction remotely.

---

## 14. Success metrics

### Product metrics

- User can complete upload → redaction → export without assistance.
- Percentage of supported screenshots successfully processed.
- Export success rate.
- Manual correction rate.
- Time to complete a typical redaction task.

### Technical metrics

- OCR accuracy on representative screenshots.
- Sensitive entity detection precision and recall.
- Redaction coverage accuracy.
- Processing latency.
- Peak browser memory.
- Local inference failure rate.

### Privacy metrics

- Zero original-image uploads in Local mode.
- Zero raw sensitive-data logs.
- No accidental inclusion of disabled redactions in exported output.
- Successful metadata removal where supported.

---

## 15. Risks and mitigations

| Risk                                          | Mitigation                                                         |
| --------------------------------------------- | ------------------------------------------------------------------ |
| Local OCR engine has poor screenshot accuracy | Benchmark multiple engines before committing                       |
| OCR returns only line-level boxes             | Support line-level redaction and evaluate word-level fallback      |
| Privacy Filter misses sensitive data          | Combine model detection with deterministic rules and manual review |
| Browser memory limits                         | Use Web Workers, image limits and lazy model loading               |
| Redaction does not fully cover text           | Add padding, test coverage and default safe mask for secrets       |
| Duplicate text causes incorrect mapping       | Use stable OCR segment IDs                                         |
| Local model download is large                 | Cache assets, show progress, consider model optimization           |
| User assumes output is guaranteed safe        | Clearly communicate limitations and require review                 |
| Future Remote mode requires large refactor    | Use OCR engine abstraction and shared domain contracts             |

---

## 16. Definition of Done — MVP

The MVP is complete when:

- [ ] Local OCR engine is selected and validated.
- [ ] Privacy Filter ONNX runs locally.
- [ ] Upload and paste image are supported.
- [ ] OCR returns text and bounding boxes.
- [ ] Sensitive entities are detected.
- [ ] Sensitive entities map to correct image regions.
- [ ] Automatic redactions are rendered.
- [ ] Manual redaction is supported.
- [ ] User can review and remove redactions.
- [ ] PNG export works.
- [ ] Original image is not uploaded in Local mode.
- [ ] No raw sensitive data is logged.
- [ ] Error handling is implemented.
- [ ] Representative screenshot test set passes.
- [ ] Basic performance benchmarks are documented.
- [ ] Architecture supports a future Remote OCR engine.

---

## 17. Product decision summary

### MVP direction

**Local-first web app using a browser-compatible OCR engine + Privacy Filter ONNX.**

### Model strategy

- Privacy detection: Local ONNX.
- OCR: Local-compatible OCR engine, to be selected in technical spike.
- Remote OCR: Unlimited-OCR in a future phase.
- MCP: Future remote integration.

### Core architectural decision

The redaction engine must depend on a normalized OCR contract, not directly on a specific OCR model.

### Key product promise

> Help users hide sensitive information from screenshots before sharing them, while keeping original images local in Local mode.
