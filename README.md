# Listing Intelligence

AI-assisted listing analysis platform for e-commerce product images, listings, charts, and PDF documents.

## Highlights

- React + FastAPI application for image-first listing workflows
- Marketplace-aware product analysis, SEO generation, and competitor comparison
- Compliance review with deterministic fix suggestions and image repair tools
- Export-oriented backend with JSON, CSV, Markdown, and PDF reporting support
- Works with local and hosted model providers, including Ollama, OpenAI, Anthropic, Google, and Azure

## Overview

Listing Intelligence is built for evaluating sellable product imagery and turning that analysis into marketplace-ready outputs. The repository combines multimodal analysis with deterministic computer-vision tools so the workflow does not stop at "describe this image" and can continue into compliance review, quality checks, OCR, object detection, and controlled image fixes.

The current app is centered on e-commerce use cases. From the frontend you can analyze a product image, review marketplace compliance, launch Fix Studio for corrective edits, compare against a competitor image, run batch analysis, and inspect usage or history. The backend also exposes generic image and PDF analysis endpoints for broader visual-analysis tasks.

## Features

- Product image analysis with listing-oriented output
- Marketplace-specific rules for channels such as Amazon, Walmart, Allegro, and Etsy
- SEO generation from product imagery
- Competitor image comparison
- Batch analysis for multiple product images
- Compliance scoring and issue detection
- Deterministic fix suggestions and apply flows for relighting, outpainting, upscaling, and text or watermark removal
- Deterministic inventory-style analysis using object detection and OCR
- Provider overrides for model, API key, and base URL from the UI or API
- Report export and usage tracking

## Quick Start

### Local development

From the repository root:

```bash
cp .env.example .env
pip install -e ".[dev]"
uvicorn api.main:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

- Frontend: [http://localhost:5173](http://localhost:5173)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### One-click launcher on macOS

```bash
./start.command
```

The launcher creates a virtual environment if needed, installs missing dependencies, starts the backend and frontend in Terminal tabs, and opens the app in the browser.

### Docker

```bash
cp .env.example .env
docker compose up --build
```

Default ports:

- Backend: `8000`
- Frontend: `3000`

## Configuration

Copy `.env.example` to `.env` and choose a provider.

Supported provider modes in the example config:

- `ollama`
- `openai`
- `grok`
- `groq`
- `anthropic`
- `google`
- `azure`

The default configuration uses local Ollama with `qwen3-vl:8b`. The frontend also exposes runtime overrides for provider, model, API key, and base URL in Settings.

## API Surface

The FastAPI backend includes endpoints for:

- general file analysis
- product analysis and full listing analysis
- marketplace listing URL or pasted listing review
- SEO generation
- compliance review and compliance fixes
- competitor comparison
- batch analysis
- object detection, OCR, quality scoring, relighting, outpainting, upscaling, and region erase operations

For endpoint details, see [docs/API.md](docs/API.md).

## Architecture

- [api/main.py](api/main.py) exposes the FastAPI app and e-commerce/image-intelligence endpoints.
- [src/vision_agent.py](src/vision_agent.py) coordinates multimodal analysis, caching, rate limiting, PDF processing, and report generation.
- [src/ecommerce/](src/ecommerce) contains marketplace logic, listing generation, compliance analysis, batch processing, and deterministic image operations.
- [frontend/src/App.tsx](frontend/src/App.tsx) wires the React UI around Product Analysis, Compliance, Fix Studio, Tools, History, Settings, and Help.

## Development

Backend checks:

```bash
pytest
```

Frontend checks:

```bash
cd frontend
npm run lint
npm run build
npm run test:e2e
```

## Documentation

- [docs/QUICKSTART.md](docs/QUICKSTART.md)
- [docs/API.md](docs/API.md)
- [docs/ECOMMERCE_GUIDE.md](docs/ECOMMERCE_GUIDE.md)
- [docs/EXPORT_GUIDE.md](docs/EXPORT_GUIDE.md)
- [docs/INDUSTRY_TEMPLATES.md](docs/INDUSTRY_TEMPLATES.md)

## License

This project is available under the PolyForm Noncommercial 1.0.0 license. Commercial use requires a separate license from the author. See [LICENSE](LICENSE) and [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).
