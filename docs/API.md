# API Reference

Vision Agent Analyst REST API. Base URL: `http://localhost:8000`

Interactive docs available at `/docs` (Swagger UI) and `/redoc` (ReDoc) when server is running.

---

## General Endpoints

### `GET /`
Root status endpoint.

**Response:**
```json
{"message": "Vision Agent Analyst API", "version": "0.2.0", "status": "running"}
```

### `GET /api/config`
Get current LLM provider configuration.

**Response:**
```json
{"provider": "ollama", "model": "qwen3-vl:8b", "temperature": 0.7, "max_tokens": 2048}
```

### `GET /api/health`
Health check with provider connectivity status.

**Response:**
```json
{"status": "healthy", "timestamp": "...", "provider": "ollama", "provider_connected": true}
```

### `GET /api/usage`
Token usage statistics.

**Response:**
```json
{"total_requests": 42, "total_tokens": 12500, "by_provider": {"ollama": {"requests": 42, "tokens": 12500}}}
```

### `GET /api/templates`
Available analysis templates (basic + industry).

**Response:**
```json
{"basic": [{"key": "general", "name": "General", "description": "...", "prompt": "..."}], "industry": [...]}
```

### `POST /api/analyze`
Analyze an uploaded file (image or PDF).

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Image (PNG/JPG/WebP) or PDF |
| `prompt` | string | Yes | Analysis prompt |
| `template_key` | string | No | Template identifier |
| `provider` | string | No | Override LLM provider |
| `model` | string | No | Override model |

**Response:**
```json
{
  "success": true,
  "filename": "photo.jpg",
  "analysis": "Detailed analysis text...",
  "metadata": {},
  "timestamp": "2025-01-01T00:00:00",
  "prompt": "...",
  "tokens_used": 450
}
```

---

## E-Commerce Endpoints

### `GET /api/ecommerce/marketplaces`
List supported marketplaces with their photo requirements.

**Response:**
```json
{
  "marketplaces": [
    {
      "id": "wildberries",
      "name": "Wildberries",
      "min_image_width": 900,
      "min_image_height": 1200,
      "max_file_size_mb": 10,
      "required_background": "white",
      "aspect_ratio": "3:4",
      "forbidden_elements": ["watermarks", "logos", "text overlays"],
      "recommendations": [...]
    }
  ]
}
```

### `POST /api/ecommerce/analyze-product`
Full product photo analysis with SEO and quality assessment.

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Product photo |
| `marketplace` | string | No | Target marketplace (default: "general") |

**Response:**
```json
{
  "success": true,
  "filename": "product.jpg",
  "analysis": "Product Description: ... SEO Title: ... Tags: ...",
  "marketplace": "wildberries",
  "metadata": {},
  "timestamp": "...",
  "tokens_used": 680
}
```

### `POST /api/ecommerce/compliance-check`
Check product photo compliance with marketplace requirements.

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Product photo |
| `marketplace` | string | Yes | Target marketplace |

**Response:**
```json
{
  "success": true,
  "filename": "product.jpg",
  "marketplace": "ozon",
  "analysis": "Compliance Status: PASS/FAIL ...",
  "metadata": {},
  "timestamp": "...",
  "tokens_used": 520
}
```

### `POST /api/ecommerce/generate-seo`
Generate SEO-optimized listing content from product image.

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Product photo |
| `marketplace` | string | No | Target marketplace (default: "general") |
| `keywords` | string | No | Target keywords (comma-separated) |

**Response:**
```json
{
  "success": true,
  "filename": "product.jpg",
  "marketplace": "amazon",
  "seo_content": "Title: ... Bullet Points: ... Description: ... Tags: ...",
  "metadata": {},
  "timestamp": "...",
  "tokens_used": 750
}
```

### `POST /api/ecommerce/batch-analyze`
Batch analyze multiple product images.

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | File[] | Yes | Multiple product photos |
| `marketplace` | string | No | Target marketplace (default: "general") |

**Response:**
```json
{
  "success": true,
  "total_files": 5,
  "processed": 5,
  "results": [
    {"filename": "img1.jpg", "analysis": "...", "success": true, "metadata": {}},
    {"filename": "img2.jpg", "analysis": "...", "success": true, "metadata": {}}
  ],
  "csv_data": "filename,analysis,...",
  "timestamp": "..."
}
```

### `POST /api/ecommerce/compare`
Compare product photo with competitor's listing.

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_image` | File | Yes | Your product photo |
| `competitor_image` | File | Yes | Competitor's product photo |
| `marketplace` | string | No | Target marketplace (default: "general") |

**Response:**
```json
{
  "success": true,
  "product_filename": "my_product.jpg",
  "competitor_filename": "competitor.jpg",
  "analysis": "Strengths: ... Weaknesses: ... Action Items: ...",
  "marketplace": "general",
  "metadata": {},
  "timestamp": "...",
  "tokens_used": 890
}
```

### `POST /api/ecommerce/suggest-improvements`
Suggest photo improvements for better conversion.

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Product photo |

**Response:**
```json
{
  "success": true,
  "filename": "product.jpg",
  "analysis": "Current Score: 6/10 ... Top 5 Improvements: ...",
  "metadata": {},
  "timestamp": "...",
  "tokens_used": 620
}
```

### `POST /api/ecommerce/extract-attributes`
Extract product attributes from photo.

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Product photo |

**Response:**
```json
{
  "success": true,
  "filename": "product.jpg",
  "attributes": "Category: Electronics ... Color: Black ... Material: Plastic ...",
  "metadata": {},
  "timestamp": "...",
  "tokens_used": 480
}
```

---

## WebSocket

### `WS /api/ws/batch-progress`
Real-time batch processing progress updates.

**Client sends:**
```json
{"action": "start_batch", "files": [...], "marketplace": "general"}
```

**Server responds:**
```json
{"type": "batch_started", "task_id": "uuid", "total": 5}
```

**Ping/Pong:**
```json
{"action": "ping"}  ->  {"type": "pong"}
```

---

## Error Responses

All endpoints return standard HTTP error codes:

| Code | Description |
|------|-------------|
| 400 | Bad request (invalid marketplace, etc.) |
| 422 | Validation error (missing required fields) |
| 500 | Internal server error |
| 503 | Agent not initialized |

Error format:
```json
{"detail": "Error message description"}
```
