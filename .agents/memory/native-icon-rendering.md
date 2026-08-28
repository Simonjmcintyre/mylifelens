---
name: Native icon rendering
description: Why MyLifelens uses SVG-drawn interface icons instead of icon fonts.
---

Use SVG-drawn interface icons for MyLifelens rather than font-based icon sets.

**Why:** Font glyph icons appeared correctly in the web preview but rendered as missing-character boxes on a physical phone. Explicitly preloading the icon font did not resolve the device issue.

**How to apply:** Add or extend icons through the shared SVG icon component so new symbols remain independent of native font loading and caching.