<div align="center">

# Vision Agent Analyst

Full-stack AI product for marketplace listing intelligence and deterministic image operations.

[![Status: Beta](https://img.shields.io/badge/status-beta-2563eb.svg)](#)
[![CI](https://github.com/KazKozDev/LISTING-INTELLIGENCE/actions/workflows/ci.yml/badge.svg)](https://github.com/KazKozDev/LISTING-INTELLIGENCE/actions)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/)
[![License: PolyForm Noncommercial](https://img.shields.io/badge/license-PolyForm%20Noncommercial-orange.svg)](LICENSE)

</div>

## Highlights

- Product-shaped AI system, not a single-model demo
- End-to-end React, FastAPI, and multimodal backend architecture
- Listing, compliance, compare, batch, and fix workflows in one app
- Deterministic CV tools where repeatability matters most
- Local-first execution path with Ollama support

## Demo

<!-- TODO: Add demo GIF or screenshot -->

## Overview

Vision Agent Analyst is a full-stack AI application built around a clear operational workflow: take raw product visuals and turn them into listing, compliance, comparison, and image-fix outputs that are usable in marketplace contexts. From a single image, the system can generate listing copy, extract attributes, score quality, compare against competitors, validate marketplace rules, and route work into deterministic fix flows. As a portfolio project, it is meant to show end-to-end product ownership across UX, backend architecture, model orchestration, and production-oriented engineering.

## Why This Project Matters

Most AI portfolio projects stop at a chat interface or a single inference call. This repository goes further by packaging model behavior into a product with explicit user flows, typed contracts, deterministic fallbacks, CI, and deployment primitives. It demonstrates the ability to make engineering decisions about when to use LLM generation, when to use deterministic computer vision, how to structure a multi-provider backend, and how to turn that into a coherent interface that looks and behaves like a real product rather than an experiment.

## Motivation

Marketplace operations are messy because the work is split across copywriting, visual QA, compliance interpretation, competitive review, and repetitive image cleanup. Generic AI tools can help with parts of that process, but they do not usually provide workflow-specific structure or reliable deterministic steps when precision matters. This project packages those responsibilities into one system and deliberately mixes LLM generation with OCR, detection, relighting, upscaling, and export-focused utilities so the product can support both creative and operational tasks.

## Features

- Product workspace for full listing generation from product images
- Competitor comparison with structured strengths, weaknesses, and next actions
- Marketplace compliance checks for publish-ready image validation
- Additional e-commerce tools for pricing, reviews, keywords, USP, and inventory workflows
- Fix Studio for deterministic image cleanup, relighting, outpainting, and export
- Batch analysis pipeline with CSV export
- Multi-provider model routing with local and hosted backends
- Core multimodal engine for visual and PDF analysis

## Architecture

Components:
- Frontend app in React 19 and TypeScript for product, compliance, fix, tools, history, settings, and help flows
- FastAPI backend exposing REST endpoints for analysis, e-commerce workflows, and image-intelligence operations
- Core VisionAgent service for multimodal analysis, provider selection, caching, token counting, and rate limiting
- E-commerce services for listing generation, compliance, comparison, SEO, batch processing, and image operations
- Config-driven prompt and model layer in `config/` for provider, logging, and template control

Flow:
- User uploads an image or document
- Frontend sends a typed request to the backend
- Backend routes the request to VisionAgent or a specialized e-commerce service
- Service combines LLM inference and, where needed, deterministic CV utilities
- API returns structured results for UI rendering, export, and follow-up actions

## Tech Stack

- Python 3.10+, FastAPI, Pydantic, Uvicorn
- React 19, TypeScript, Vite
- Ollama, OpenAI, Anthropic, Google Gemini, Azure OpenAI
- Ultralytics YOLO, EasyOCR, diffusers, Real-ESRGAN, Florence-based image tooling
- Pytest, Black, Ruff, Mypy
- Docker and Docker Compose

## Quick Start

1. Clone the repository and create your environment file.

```bash
git clone https://github.com/KazKozDev/LISTING-INTELLIGENCE.git
cd LISTING-INTELLIGENCE
cp .env.example .env
```

2. Install backend dependencies.

```bash
pip install -e ".[dev]"
```

3. Start the backend.

```bash
uvicorn api.main:app --reload --port 8000
```

4. Start the frontend in a new terminal.

```bash
cd frontend
npm install
npm run dev
```

Default local URLs:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs

### Docker

```bash
docker-compose up
```

Docker exposes:
- Frontend on port `3000`
- Backend on port `8000`

## Usage

1. Open Product Workspace to generate listing copy, compare products, or run batch image analysis.
2. Open Compliance Check to validate marketplace image rules before publishing.
3. Open Fix Studio to run deterministic image cleanup, relighting, outpainting, upscaling, and export tasks.
4. Open Additional Tools for focused workflows such as keyword gaps, competitor insights, pricing analysis, and inventory checks.

## API

Key routes:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/config` | Active provider and app configuration |
| `POST` | `/api/analyze` | General file analysis |
| `GET` | `/api/ecommerce/marketplaces` | Marketplace rules metadata |
| `POST` | `/api/ecommerce/analyze-product-full` | Full listing analysis from a product image |
| `POST` | `/api/ecommerce/compliance-check` | Marketplace compliance workflow |
| `POST` | `/api/ecommerce/compare` | Competitor comparison |
| `POST` | `/api/ecommerce/batch-analyze` | Batch workflow with CSV export |
| `POST` | `/api/ecommerce/inventory-check` | Deterministic object detection and OCR shelf analysis |

Full API reference: [docs/API.md](docs/API.md)

## Project Structure

```text
vision-agent-analyst/
├── api/                 FastAPI routes and response schemas
├── config/              Model, prompt, policy, and logging configuration
├── docs/                API and feature documentation
├── examples/            Python usage examples
├── frontend/            React + TypeScript client application
├── src/                 Core agent, providers, utilities, and e-commerce services
├── tests/               Pytest suite and fixtures
├── Dockerfile           Backend container build
├── docker-compose.yml   Full local stack orchestration
└── pyproject.toml       Python package metadata and tooling config
```

## Testing

Backend checks:

```bash
black --check src/ api/ config/ tests/
ruff check src/ api/ config/ tests/
mypy src/ api/ --ignore-missing-imports
pytest --cov=src --cov=api --cov-report=term-missing --cov-fail-under=70
```

Frontend checks:

```bash
cd frontend
npm run lint
npm run build
```

CI in [.github/workflows/ci.yml](.github/workflows/ci.yml) runs Python linting, mypy, pytest coverage, frontend lint/build, and Docker image build.

## Documentation

- [docs/API.md](docs/API.md) — REST API reference
- [docs/ECOMMERCE_GUIDE.md](docs/ECOMMERCE_GUIDE.md) — e-commerce workflows and usage
- [docs/QUICKSTART.md](docs/QUICKSTART.md) — startup notes
- [docs/EXPORT_GUIDE.md](docs/EXPORT_GUIDE.md) — export flows and formats
- [docs/INDUSTRY_TEMPLATES.md](docs/INDUSTRY_TEMPLATES.md) — configured analysis templates
- [docs/NEW_FEATURES.md](docs/NEW_FEATURES.md) — recent product additions

## License

This project is available under the PolyForm Noncommercial 1.0.0 license for personal, educational, research, portfolio, and other non-commercial use.

Commercial use requires a separate paid license.

See [LICENSE](LICENSE) for the non-commercial terms and [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) for commercial licensing details.

## Commercial Use

This repository is source-available.

Commercial licensing contact:

- Email: KazKozDev@gmail.com
- [GitHub](https://github.com/KazKozDev)
- [LinkedIn](https://www.linkedin.com/in/kazkozdev/)

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Run backend and frontend checks before opening a pull request.
4. Submit a pull request with a concise change summary.

---

<div align="center">

[Artem KK](https://www.linkedin.com/in/kazkozdev/) | PolyForm Noncommercial [LICENSE](LICENSE) | [Commercial Licensing](COMMERCIAL-LICENSE.md)

</div>
