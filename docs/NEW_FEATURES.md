# Product Surface Updates

This document summarizes the current public-facing product surface in Listing Intelligence.

## Main Workflows

### Product Workspace

The primary workflow for listing work.

Current capabilities:

- product image analysis
- full listing generation
- SEO-oriented output
- competitor comparison
- batch analysis for multiple images

### Compliance

Marketplace-specific image review with pass/fail guidance.

Current capabilities:

- marketplace-aware compliance checks
- issue summaries and severity cues
- handoff into Fix Studio when the image needs correction

### Fix Studio

Deterministic correction workspace for image repair and export review.

Current capabilities:

- compliance-fix suggestions
- controlled fix application
- relighting
- outpainting
- upscaling
- text or watermark removal

### Additional Tools

Focused workflows for narrower tasks.

Current tools include:

- competitor insights
- keyword gap analysis
- USP extraction
- pricing analysis
- review sentiment
- Object Scan for deterministic object detection and OCR review

## Product Characteristics

What differentiates the current build:

- one UI for generative listing work and deterministic image operations
- local or hosted provider routing through the same product surface
- persistent run history in the frontend
- export support for JSON, CSV, and Markdown from saved runs
- marketplace-aware flows rather than generic image prompting

## Backend Coverage

The current API surface supports:

- general file analysis
- product analysis and full listing analysis
- listing URL or pasted listing analysis
- compliance review and compliance fix flows
- competitor comparison and batch analysis
- object detection, OCR, Florence analysis, quality scoring, relighting, outpainting, upscaling, and erase operations

## Notes

- This file is intentionally descriptive, not a changelog with speculative roadmap items.
- For endpoint details, see [API.md](API.md).
- For setup and usage, see [QUICKSTART.md](QUICKSTART.md).
