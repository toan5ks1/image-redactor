# MVP Validation

Run the repeatable local checks with:

```sh
pnpm validate
```

## Automated baseline

Measured on 2026-09-12 in the development workspace. Timings are directional and vary by machine.

| Check | Result |
| --- | --- |
| Unit regression suite | 14 tests in approximately 0.1 seconds |
| TypeScript + Vite production build | Approximately 1.8 seconds |
| Initial application JavaScript | 205.04 kB minified / 65.68 kB gzip |
| OCR worker JavaScript | 459.58 kB, loaded when processing starts |
| Privacy worker JavaScript | 536.81 kB, loaded when processing starts |

The suite covers PNG/JPEG signature and size validation, the 10,000-pixel dimension limit,
duplicate text mapping, coordinate clamping, opaque secret defaults, deterministic detection,
cancellation, and the no-console-logging privacy policy.

## Browser acceptance run

The following checks require a supported browser, downloaded model assets, representative
screenshots, and browser performance/network tooling. Record hardware, browser version, image
dimensions, cold/warm cache state, elapsed time, and peak memory for each run.

- [ ] PNG and JPEG upload, drag/drop, and clipboard paste.
- [ ] OCR returns valid line and word boxes for English, Vietnamese, logs, and code screenshots.
- [ ] OCR plus detection completes within 10 seconds after models are cached.
- [ ] The UI stays responsive while both workers run.
- [ ] Duplicate, multiline, punctuation, whitespace, and partial-text entities map correctly.
- [ ] Blur, pixelate, and mask previews match exported pixels.
- [ ] In-page Redacted, Original, and Compare review modes remain usable at desktop and narrow widths; the Compare divider supports direct pointer drag and keyboard range input.
- [ ] Manual, moved, resized, disabled, overlapping, undo, and redo cases export correctly.
- [ ] PNG export completes within 3 seconds and preserves original dimensions.
- [ ] Network inspection shows model downloads but no original-image upload.
- [ ] Console inspection shows no image content, OCR text, or detected secrets.
- [ ] Chrome, Edge, and Firefox complete the local flow or show an explicit compatibility error.
- [ ] Screen reader announces processing, errors, and degraded rules-only mode.

Do not mark the PRD's representative-screenshot or browser-performance Definition of Done items
complete until these browser results are recorded.
