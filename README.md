<div align="center">

# Vision Agent Analyst

**AI-powered product photo optimization for e-commerce sellers**

Turn product photos into marketplace-ready listings — SEO titles, descriptions, tags, compliance reports, and competitor analysis. In seconds, not hours.

[![CI](https://github.com/KazKozDev/vision-agent-analyst/actions/workflows/ci.yml/badge.svg)](https://github.com/KazKozDev/vision-agent-analyst/actions)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](#tests)

</div>

---

## The Problem

Sellers spend hours writing descriptions, guessing keywords, and hoping their photos pass marketplace moderation. For every SKU. On every platform. Multiply that by 200 products and you have a full-time job that adds zero value.

## The Solution

Drop a product photo. Get everything you need to list it:

- **SEO-optimized title, bullet points, description, and 15+ search tags** — tuned for your marketplace
- **Compliance check** — pass/fail against Wildberries, Ozon, Amazon, or eBay requirements before you upload
- **Quality score** — lighting, composition, background rated 1-10 with specific improvement suggestions
- **Competitor comparison** — side-by-side analysis of your product vs competitor listings
- **Batch processing** — analyze 100+ photos at once, export results as CSV

All of this runs **locally with Ollama** — your product data never leaves your machine.

---

## Quick Start

**Prerequisites:** Python 3.10+, Node.js 18+, [Ollama](https://ollama.com/) (default LLM provider)

```bash
# 1. Install Ollama and pull a vision model
ollama pull qwen3-vl:8b

# 2. Clone and setup
git clone https://github.com/KazKozDev/vision-agent-analyst.git
cd vision-agent-analyst
cp .env.example .env

# 3. Backend
pip install -e ".[dev]"
uvicorn api.main:app --reload --port 8000

# 4. Frontend (new terminal)
cd frontend && npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Docker (one command)

```bash
docker-compose up
# Backend :8000 | Frontend :3000
```

---

## Features

### Product Analysis

Upload a product photo and receive a structured breakdown: description, category, attributes, SEO title, search tags, quality score (1-10), and actionable improvement tips.

### SEO Generator

Generate marketplace-optimized listing content from a single photo. Includes title (60-80 chars), bullet points, full description, search tags, and backend keywords. Specify target keywords to fine-tune output.

### Compliance Check

Verify photos against specific marketplace requirements before uploading. Checks resolution, background color, aspect ratio, forbidden elements (watermarks, text overlays, logos). Returns pass/fail with severity-rated issues and fix recommendations.

### Competitor Compare

Upload your product photo and a competitor's listing side by side. Get a structured analysis: your strengths, weaknesses, competitive edge opportunities, and 3 specific action items to outperform.

### E-Commerce Tools

Eight specialized analysis modes accessible from a single interface:

| Tool | What It Does |
|------|-------------|
| Photo Improvements | AI suggestions ranked by expected conversion impact |
| Extract Attributes | Auto-detect product characteristics (color, material, size, brand) |
| Listing Audit | Grade your listing A-F with missing keyword suggestions |
| Pricing Analysis | Deconstruct competitor pricing strategy and positioning |
| Review Sentiment | Analyze customer reviews — top praise, top complaints, action items |
| Packaging Critique | Evaluate shelf appeal and unboxing experience |
| Visual Search SEO | Optimize images for Google Lens and Pinterest visual search |
| Inventory Check | Estimate stock levels and planogram compliance from shelf photos |

### Batch Processing

Drag multiple product photos (or a folder). Track real-time progress with thumbnail status indicators. Export all results as a CSV ready for marketplace upload.

---

## Supported Marketplaces

| Marketplace | Min Resolution | Background | Aspect Ratio | Key Rules |
|------------|---------------|-----------|-------------|-----------|
| **Wildberries** | 900 x 1200 | White / transparent | 3:4 | No watermarks, no promo text, no collages |
| **Ozon** | 900 x 1200 (rec.) | White preferred | 1:1 or 3:4 | No contact info, no URLs, no price comparisons |
| **Amazon** | 1000 x 1000 | Pure white RGB(255,255,255) | 1:1 | Product fills 85% of frame, no badges or borders |
| **eBay** | 500 x 500 | White / neutral | 1:1 | No stock photos for used items, no obscuring text |

Marketplace rules are shown inline in the UI when you select a platform.

---

## LLM Providers

Switch between 5 providers by changing one environment variable:

| Provider | `LLM_PROVIDER` | API Key Required |
|----------|----------------|------------------|
| Ollama | `ollama` | No (local) |
| OpenAI | `openai` | Yes |
| Anthropic | `anthropic` | Yes |
| Google Gemini | `google` | Yes |
| Azure OpenAI | `azure` | Yes |

Ollama is the default — no API key needed, everything stays on your machine.

---

## API

13 REST endpoints + WebSocket for real-time progress.

| Method | Endpoint | Purpose |
|--------|---------|---------|
| `GET` | `/` | Root status |
| `GET` | `/api/config` | Current LLM provider configuration |
| `POST` | `/api/analyze` | Universal file analysis (image or PDF) |
| `GET` | `/api/health` | Provider connectivity status |
| `GET` | `/api/usage` | Token usage statistics |
| `GET` | `/api/ecommerce/marketplaces` | Marketplace rules and requirements |
| `POST` | `/api/ecommerce/analyze-product` | Product photo analysis |
| `POST` | `/api/ecommerce/compliance-check` | Marketplace compliance verification |
| `POST` | `/api/ecommerce/generate-seo` | SEO content generation |
| `POST` | `/api/ecommerce/batch-analyze` | Batch analysis with CSV export |
| `POST` | `/api/ecommerce/compare` | Competitor photo comparison |
| `POST` | `/api/ecommerce/suggest-improvements` | Photo improvement suggestions |
| `POST` | `/api/ecommerce/extract-attributes` | Product attribute extraction |
| `WS` | `/api/ws/batch-progress` | Real-time batch processing progress |

**Quick example:**

```bash
# Analyze a product photo
curl -X POST http://localhost:8000/api/ecommerce/analyze-product \
  -F "file=@product.jpg" \
  -F "marketplace=amazon"

# Generate SEO listing
curl -X POST http://localhost:8000/api/ecommerce/generate-seo \
  -F "file=@product.jpg" \
  -F "marketplace=wildberries" \
  -F "keywords=wireless,bluetooth,headphones"
```

Interactive docs at [http://localhost:8000/docs](http://localhost:8000/docs) when server is running. Full reference in [docs/API.md](docs/API.md).

---

## Architecture

```
Frontend (React 19 + TypeScript + Vite)    Backend (FastAPI + Python 3.10+)
┌──────────────────────────────┐     ┌──────────────────────────────────┐
│  8 E-commerce Components    │     │  VisionAgent (core engine)       │
│  6 Core Components          │     │  ProductAnalyzer / SEOGenerator  │
│  2 Custom Hooks             │────▶│  BatchProcessor                  │
│  Typed API Client           │     │  LLM Factory (5 providers)       │
│  Error Boundaries           │     │  Cache / RateLimiter / Tokens    │
└──────────────────────────────┘     └──────────────┬───────────────────┘
                                                    │
                                         ┌──────────▼──────────┐
                                         │  Ollama  │  OpenAI  │
                                         │  Claude  │  Gemini  │
                                         │        Azure       │
                                         └────────────────────┘
```

**Backend patterns:** Factory pattern for LLM providers, Pydantic v2 BaseSettings for configuration, file-based caching with TTL, token-bucket rate limiting, structured JSON logging, cost tracking per provider.

**Frontend patterns:** Custom hooks for state management, centralized API client with full TypeScript types, drag-and-drop file upload, parsed LLM response rendering.

---

## Project Structure

```
vision-agent-analyst/
├── api/                          # FastAPI backend
│   ├── main.py                   # 13 endpoints + WebSocket + middleware
│   └── schemas.py                # Pydantic v2 request/response models
├── src/
│   ├── vision_agent.py           # Core analysis engine with caching
│   ├── ecommerce/                # E-commerce module
│   │   ├── product_analyzer.py   # Product analysis, compliance, comparison
│   │   ├── marketplace_rules.py  # WB, Ozon, Amazon, eBay rules
│   │   ├── seo_generator.py      # SEO title, description, tags
│   │   └── batch_processor.py    # Multi-file processing + CSV export
│   ├── llm/                      # LLM provider abstraction
│   │   ├── factory.py            # Provider factory (Strategy pattern)
│   │   ├── ollama_provider.py
│   │   ├── openai_provider.py
│   │   ├── anthropic_provider.py
│   │   ├── google_provider.py
│   │   └── azure_provider.py
│   └── utils/                    # Cache, RateLimiter, TokenCounter, CostTracker
├── frontend/src/
│   ├── components/               # 6 core + 8 e-commerce UI components
│   │   └── ecommerce/            # ProductAnalysis, SEOPreview, ComplianceReport,
│   │                             # CompetitorCompare, BulkUpload, EcommerceTools,
│   │                             # MarketplaceSelector, ExportCSV
│   ├── hooks/                    # useHistory, useConfig
│   └── api/                      # Typed API client + TypeScript interfaces
├── config/                       # prompts.yaml, model_config.yaml, logging
├── tests/                        # 80 tests (all mocked, no API keys needed)
│   └── fixtures/                 # Test images + PDF
├── docs/                         # API.md, ECOMMERCE_GUIDE.md, QUICKSTART.md
├── examples/                     # Python usage examples
├── docker-compose.yml
├── Dockerfile                    # Multi-stage build (Node + Python)
├── pyproject.toml                # Dependencies, black, ruff, mypy, pytest config
└── .github/workflows/ci.yml     # Lint + Test + Build + Docker
```

---

## Configuration

```env
# .env
LLM_PROVIDER=ollama              # ollama | openai | anthropic | google | azure
LLM_MODEL=qwen3-vl:8b           # any vision-capable model
LLM_API_KEY=                     # not needed for Ollama
LLM_BASE_URL=http://localhost:11434
MAX_TOKENS=2048
TEMPERATURE=0.7
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

Configuration uses Pydantic BaseSettings — values come from `.env`, environment variables, or constructor arguments. See [.env.example](.env.example) for all options.

---

## Tests

```bash
pytest tests/ -v
# 80 tests passed — VisionAgent, providers, API, PDF processor,
# cache, rate limiter, export, config, cost tracker
```

All tests run without API keys (fully mocked). Coverage report:

```bash
pytest tests/ --cov=src --cov=api --cov=config --cov-report=term-missing
```

---

## Documentation

| Document | Description |
|---------|-------------|
| [docs/API.md](docs/API.md) | Full REST API reference with request/response examples |
| [docs/ECOMMERCE_GUIDE.md](docs/ECOMMERCE_GUIDE.md) | E-commerce module usage guide |
| [docs/QUICKSTART.md](docs/QUICKSTART.md) | 2-minute quick start for new features |
| [docs/INDUSTRY_TEMPLATES.md](docs/INDUSTRY_TEMPLATES.md) | 50+ analysis template documentation |
| [docs/EXPORT_GUIDE.md](docs/EXPORT_GUIDE.md) | Export to JSON, CSV, PDF |

---

## Contributing

1. Fork the repo and create a branch from `main`
2. Install dependencies:
   ```bash
   pip install -e ".[dev]"
   cd frontend && npm install
   ```
3. Make your changes
4. Make sure everything passes before pushing:
   ```bash
   black --check src/ api/ tests/
   ruff check src/ api/ tests/
   pytest tests/ -v
   cd frontend && npm run build
   ```
5. Open a Pull Request

CI runs lint, tests, frontend build, and Docker build automatically on every PR.

---

<div align="center">

[Artem KK](https://www.linkedin.com/in/kazkozdev/) | MIT [LICENSE](LICENSE)

</div>
