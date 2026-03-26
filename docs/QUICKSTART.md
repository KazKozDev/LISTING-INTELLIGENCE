# Quick Start

This guide matches the current React + FastAPI application.

## 1. Start The App

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

- Frontend: http://localhost:5173
- Backend docs: http://localhost:8000/docs

## 2. Run The Main Workflow

1. Open Product Workspace.
2. Upload a product image.
3. Pick the target marketplace.
4. Run full analysis to get listing text, quality observations, and structured output.
5. Use compare, SEO, batch, or targeted tools if you need a narrower result.

## 3. Check Marketplace Compliance

1. Open Compliance.
2. Upload the product image.
3. Select the marketplace.
4. Review the verdict, score, and issues.
5. If needed, open Fix Studio from the compliance flow.

## 4. Apply Deterministic Fixes

In Fix Studio you can work through controlled image operations such as:

- marketplace-aware recentering and framing
- relighting
- outpainting
- upscaling
- text or watermark removal

Use this flow when the question is not "what should I write?" but "how do I correct this exact image?"

## 5. Export Results

The app supports export-oriented workflows for analysis and reports.

- Use JSON when you need structured data
- Use CSV for batch or spreadsheet workflows
- Use PDF for shareable reports

## 6. Switch Providers

Open Settings to set a provider, model, API key, or base URL override.

Current stack supports local and hosted routing, including Ollama and several hosted providers documented in the main README.

## 7. Useful Docs

- [README.md](../README.md)
- [API.md](API.md)
- [ECOMMERCE_GUIDE.md](ECOMMERCE_GUIDE.md)
- [EXPORT_GUIDE.md](EXPORT_GUIDE.md)
- [INDUSTRY_TEMPLATES.md](INDUSTRY_TEMPLATES.md)
