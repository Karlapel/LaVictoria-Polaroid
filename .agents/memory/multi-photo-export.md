---
name: Multi-photo export
description: Product boundary for multi-photo editing and export.
---

Multi-photo mode keeps framing and captions on each uploaded photo independently, and currently downloads separate Polaroid PNG files in upload order. Print-sheet/A4 composition is intentionally a later phase.

**Why:** Separate files preserve the existing browser-only Polaroid workflow without introducing a new layout or PDF model before the product is ready for printing.

**How to apply:** Future batch/print work should consume the existing per-photo format, framing, caption, and ordering state rather than replacing the individual export path.