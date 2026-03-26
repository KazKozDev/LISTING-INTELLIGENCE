# Listing Intelligence

Full-stack AI application for marketplace listing intelligence, compliance review, competitor analysis, and deterministic image operations.

## Highlights

- React + FastAPI application for image-first listing workflows
- Marketplace-aware product analysis, SEO generation, and competitor comparison
- Compliance review with deterministic fix suggestions and image repair tools
- Typed API, usage tracking, caching, rate limiting, and export-oriented reporting
- Works with local and hosted model providers, including Ollama, OpenAI, Anthropic, Google, and Azure

## Overview

Listing Intelligence is built for evaluating sellable product imagery and turning that analysis into marketplace-ready outputs. It combines multimodal LLM analysis with deterministic computer-vision workflows so the system can move from interpretation into operational tasks such as compliance review, quality checks, OCR, object detection, and controlled image correction.

The current app is centered on e-commerce use cases. From the frontend you can analyze a product image, review marketplace compliance, launch Fix Studio for corrective edits, compare against a competitor image, run batch analysis, and inspect usage or history. Under the hood, the repository reflects product-shaped engineering concerns rather than a single-model demo: multi-provider routing, typed API schemas, caching, token accounting, rate limiting, CI, and Dockerized local deployment.

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

## Tech Stack

- React 19, TypeScript, and Vite for the frontend application
- FastAPI and Pydantic for the backend and typed API contracts
- Multimodal provider routing across Ollama, OpenAI, Anthropic, Google, and Azure
- OCR, object detection, quality scoring, relighting, upscaling, outpainting, and inpainting pipelines
- Pytest, Playwright, GitHub Actions, and Docker for validation and local deployment

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

## Usage

### Analyze a product image

1. Open Product Workspace.
2. Upload a product image.
3. Select the marketplace.
4. Run the full analysis flow to generate listing-oriented output, quality observations, and structured results.

### Review compliance and fix the image

1. Open Compliance.
2. Upload an image and select the marketplace.
3. Review the verdict, score, and issues.
4. Launch Fix Studio to apply deterministic corrections such as relighting, outpainting, upscaling, or text removal.

### Review a listing source

Use the backend listing-analysis endpoint when you need to review a listing URL or pasted listing text against the same marketplace-oriented workflow.

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

CI is configured in GitHub Actions for backend linting, type checking, tests, frontend lint/build, and Docker image builds.

## Documentation

- [docs/QUICKSTART.md](docs/QUICKSTART.md)
- [docs/API.md](docs/API.md)
- [docs/ECOMMERCE_GUIDE.md](docs/ECOMMERCE_GUIDE.md)
- [docs/EXPORT_GUIDE.md](docs/EXPORT_GUIDE.md)
- [docs/INDUSTRY_TEMPLATES.md](docs/INDUSTRY_TEMPLATES.md)

---

PolyForm Noncommercial 1.0.0 - see [LICENSE](LICENSE) and [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)

If you like this project, please give it a star

For questions, feedback, or support, reach out to:

[LinkedIn](https://www.linkedin.com/in/kazkozdev/)
[Email](mailto:kazkozdev@gmail.com)
