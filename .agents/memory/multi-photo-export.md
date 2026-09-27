---
name: Multi-photo export
description: Product boundary for multi-photo editing and export.
---

Multi-photo mode keeps framing and captions on each uploaded photo independently, downloads separate Polaroid PNG files in upload order, and now feeds a visual A4 print-mount preview. PDF/printing remains a later phase.

**Why:** The A4 preview can validate page counts, spacing, ordering, and framing without changing the existing browser-only editor or committing to a PDF implementation.

**How to apply:** Future PDF/printing work should consume the existing per-photo format, framing, caption, and ordering state plus the A4 page geometry; do not replace the individual export path.