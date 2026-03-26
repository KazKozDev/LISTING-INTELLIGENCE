<div align="center">

# Listing Intelligence

AI workspace for marketplace listings, compliance review, and deterministic product-image fixes.

[![Status: Beta](https://img.shields.io/badge/status-beta-2563eb.svg)](#)
[![CI](https://github.com/KazKozDev/LISTING-INTELLIGENCE/actions/workflows/ci.yml/badge.svg)](https://github.com/KazKozDev/LISTING-INTELLIGENCE/actions)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/)
[![License: PolyForm Noncommercial](https://img.shields.io/badge/license-PolyForm%20Noncommercial-orange.svg)](LICENSE)

</div>

## What It Is

Listing Intelligence is a full-stack application for product-image analysis and marketplace operations. It combines LLM-driven listing workflows with deterministic computer-vision utilities, so the same system can both generate copy and perform repeatable image corrections.

The current product is organized around four working modes:

- Product Workspace for listing analysis, SEO output, comparison, and batch runs
- Compliance for marketplace image audits against Amazon, Walmart, eBay, Allegro, and general rules
- Fix Studio for deterministic correction flows such as recentering, relighting, outpainting, watermark/text removal, and export review
- Additional Tools for narrower workflows like attribute extraction, inventory scans, pricing, keyword gaps, and related analysis

## Why It Exists

Marketplace work usually gets split across several disconnected tools: one for copy, one for image review, one for compliance checks, and another for cleanup. This project pulls those steps into one product surface and makes a clear distinction between two kinds of work:

- generative tasks, where an LLM is useful
- deterministic tasks, where predictable CV pipelines are safer

That separation is the point of the repo. It is not just a model wrapper. It is a product-shaped system with UI, API, routing, validation, export, history, and image-operation pipelines.

## Core Capabilities

- Generate listing analysis and SEO-oriented product copy from uploaded images
- Compare a product image against a competitor image and return structured recommendations
- Run marketplace compliance audits with explicit pass/fail style guidance
- Suggest and apply deterministic compliance fixes
- Process multiple product images in batch and export CSV output
- Run object detection, OCR, quality scoring, Florence analysis, relighting, outpainting, upscaling, and erase flows
- Switch between local and hosted model providers from the same product

## Stack

- Frontend: React 19, TypeScript, Vite
- Backend: FastAPI, Pydantic, Uvicorn
- LLM providers: Ollama, OpenAI, Anthropic, Google Gemini, Azure OpenAI
- Vision tooling: YOLO, EasyOCR, Florence-2, diffusers, Real-ESRGAN, LaMa, IC-Light
- Tooling: Pytest, Ruff, Black, Mypy, Docker, Docker Compose

## Architecture

- [frontend](frontend) contains the React client and the product workflows users interact with
- [api](api) exposes the HTTP API used by the frontend and external clients
- [src](src) contains the core agent, provider integrations, report/export logic, and e-commerce/image services
- [config](config) contains model, prompt, policy, and logging configuration
- [tests](tests) covers backend behavior and service-level flows

The backend routes requests either into multimodal LLM analysis or into deterministic image tooling, depending on the operation. That split is visible both in the UI and in the API surface.

## Quick Start

1. Clone the repository and create the local environment file.

```bash
git clone https://github.com/KazKozDev/LISTING-INTELLIGENCE.git
cd LISTING-INTELLIGENCE
cp .env.example .env
```

2. Install backend dependencies.

```bash
pip install -e ".[dev]"
```

3. Start the API server.

```bash
uvicorn api.main:app --reload --port 8000
```

4. Start the frontend in a second terminal.

```bash
cd frontend
npm install
npm run dev
```

5. Open the app and docs.

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Docker

```bash
docker-compose up --build
```

The compose stack exposes:

- frontend on port 3000
- backend on port 8000

## First Workflow

1. Open Product Workspace.
2. Upload a product image.
3. Choose the marketplace.
4. Run full product analysis or a targeted tool.
5. If the image fails policy review, move into Compliance.
6. If the image needs correction, open Fix Studio and apply a deterministic fix.

## API Highlights

Important routes in the current backend:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/config` | Current provider and model configuration |
| `GET` | `/api/health` | Backend and provider connectivity status |
| `POST` | `/api/analyze` | General file analysis |
| `POST` | `/api/ecommerce/analyze-product` | Product photo analysis |
| `POST` | `/api/ecommerce/analyze-product-full` | Product analysis plus SEO-style output |
| `POST` | `/api/ecommerce/analyze-listing` | Listing URL or pasted listing text analysis |
| `POST` | `/api/ecommerce/compliance-check` | Marketplace compliance review |
| `POST` | `/api/ecommerce/compliance-fix/suggestions` | Deterministic fix suggestions |
| `POST` | `/api/ecommerce/compliance-fix/apply` | Apply a selected deterministic fix |
| `POST` | `/api/ecommerce/compare` | Product vs competitor comparison |
| `POST` | `/api/ecommerce/batch-analyze` | Batch processing for multiple product images |
| `POST` | `/api/ecommerce/inventory-check` | Deterministic object detection plus OCR review |
| `POST` | `/api/image-intelligence/relight/apply` | IC-Light relighting |
| `POST` | `/api/image-intelligence/outpaint/apply` | Canvas expansion and outpainting |
| `POST` | `/api/image-intelligence/erase` | Remove text or watermarks with inpainting |

Full endpoint details are in [docs/API.md](docs/API.md).

## Project Structure

```text
LISTING-INTELLIGENCE/
├── api/                 FastAPI routes and response schemas
├── config/              Model, prompt, marketplace, and logging config
├── docs/                Product and API documentation
├── examples/            Example scripts for API usage
├── frontend/            React client
├── src/                 Core services, providers, exporters, and CV tooling
├── tests/               Backend test suite
├── Dockerfile           Backend container image
├── docker-compose.yml   Local full-stack orchestration
└── pyproject.toml       Python package metadata and tooling config
```

## Development Checks

Backend:

```bash
black --check src/ api/ config/ tests/
ruff check src/ api/ config/ tests/
mypy src/ api/ --ignore-missing-imports
pytest -q
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

CI in [.github/workflows/ci.yml](.github/workflows/ci.yml) runs backend checks, frontend lint/build, and Docker image validation.

## Documentation

- [docs/API.md](docs/API.md) for the backend API
- [docs/QUICKSTART.md](docs/QUICKSTART.md) for a short setup and usage path
- [docs/ECOMMERCE_GUIDE.md](docs/ECOMMERCE_GUIDE.md) for marketplace workflows
- [docs/EXPORT_GUIDE.md](docs/EXPORT_GUIDE.md) for export formats and reports
- [docs/INDUSTRY_TEMPLATES.md](docs/INDUSTRY_TEMPLATES.md) for configurable prompt templates

## License

This repository is source-available under PolyForm Noncommercial 1.0.0 for personal, educational, research, and other non-commercial use.

Commercial use requires a separate license. See [LICENSE](LICENSE) and [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

## Commercial Contact

- Email: KazKozDev@gmail.com
- GitHub: https://github.com/KazKozDev
- LinkedIn: https://www.linkedin.com/in/kazkozdev/
