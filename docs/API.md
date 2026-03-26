# API Reference

Listing Intelligence REST API.

Base URL for local development:

```text
http://localhost:8000
```

Interactive docs are available at:

- `/docs`
- `/redoc`

## Root And System Endpoints

### `GET /`

Basic service status.

Example response:

```json
{
  "message": "Listing Intelligence API",
  "version": "1.0.1-beta",
  "status": "running"
}
```

### `GET /api/config`

Returns active provider and application configuration.

### `GET /api/health`

Returns health information and provider connectivity state.

### `GET /api/usage`

Returns token usage totals tracked by the backend.

### `GET /api/models?provider=<name>`

Lists models for a given provider.

## General Analysis

### `POST /api/analyze`

Analyze an uploaded file.

Form fields:

- `file`
- `prompt`
- `template_key` optional
- `provider` optional
- `model` optional
- `api_key` optional
- `base_url` optional

### `POST /api/ecommerce/analyze-listing`

Analyze a listing URL or pasted listing text.

Form fields:

- `source_mode` with value `url` or `manual`
- `listing_url` when using URL mode
- `listing_text` when using manual mode
- `prompt` optional
- `template_key` optional
- provider override fields optional

## Marketplace And Listing Endpoints

### `GET /api/ecommerce/marketplaces`

Returns supported marketplaces and their configured rules.

### `POST /api/ecommerce/analyze-product`

Analyze a product image.

Form fields:

- `file`
- `marketplace` optional
- provider override fields optional

### `POST /api/ecommerce/analyze-product-full`

Run a fuller product-analysis workflow with listing-oriented output.

Form fields:

- `file`
- `marketplace` optional
- `keywords` optional
- provider override fields optional

### `POST /api/ecommerce/generate-seo`

Generate SEO-oriented listing content from a product image.

### `POST /api/ecommerce/compare`

Compare one product image with one competitor image.

Form fields:

- `product_image`
- `competitor_image`
- `marketplace` optional
- provider override fields optional

### `POST /api/ecommerce/batch-analyze`

Batch-analyze multiple product images.

Form fields:

- `files`
- `marketplace` optional
- `keywords` optional
- provider override fields optional

## Compliance Endpoints

### `POST /api/ecommerce/compliance-check`

Run marketplace compliance review for a product image.

Form fields:

- `file`
- `marketplace`
- provider override fields optional

### `POST /api/ecommerce/compliance-fix/suggestions`

Return deterministic fix suggestions for a non-compliant image.

Form fields:

- `file`
- `marketplace`

### `POST /api/ecommerce/compliance-fix/apply`

Apply a selected deterministic fix and return before/after analysis.

Form fields:

- `file`
- `marketplace`
- `action`
- `transform_payload` optional
- provider override fields optional

## Focused Analysis Endpoints

### `POST /api/ecommerce/suggest-improvements`

Return improvement guidance for a product image.

### `POST /api/ecommerce/extract-attributes`

Extract product attributes from an uploaded image.

### `POST /api/ecommerce/inventory-check`

Run deterministic object detection and OCR for shelf or inventory-style images.

## Image Intelligence Endpoints

### `POST /api/image-intelligence/quality`

Neural image-quality scoring.

### `POST /api/image-intelligence/objects`

Object detection.

### `POST /api/image-intelligence/text`

OCR text detection.

### `POST /api/image-intelligence/florence`

Florence-based image analysis.

### `POST /api/image-intelligence/upscale`

Recommendation endpoint for whether an image should be upscaled.

### `POST /api/image-intelligence/relight/apply`

Apply IC-Light relighting.

Form fields:

- `image`
- `prompt` optional
- `light_direction` optional

### `POST /api/image-intelligence/upscale/apply`

Apply Real-ESRGAN upscaling.

### `POST /api/image-intelligence/outpaint/apply`

Expand the image canvas and outpaint the new region.

Form fields:

- `image`
- `direction` optional
- `expand_ratio` optional
- `prompt` optional

### `POST /api/image-intelligence/erase`

Erase selected regions such as text or watermarks.

Form fields:

- `image`
- `regions` as JSON-encoded bounding boxes

## Error Format

Typical error response:

```json
{
  "detail": "Error message"
}
```

Typical status codes:

- `400` invalid request or unsupported values
- `422` missing or invalid form data
- `500` internal processing error
- `503` agent unavailable
- `504` long-running operation timed out
