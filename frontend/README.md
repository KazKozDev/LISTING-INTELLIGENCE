# Frontend

This directory contains the React client for Listing Intelligence.

## Responsibilities

- Product Workspace for listing and product analysis flows
- Compliance review for marketplace image checks
- Fix Studio for deterministic image correction workflows
- Additional Tools, History, Settings, and Help surfaces

## Development

```bash
npm install
npm run dev
```

The Vite dev server runs on http://localhost:5173 by default.

To point the frontend at a different backend, set `VITE_API_URL`.

## Build And Lint

```bash
npm run lint
npm run build
```

## Notes

- The frontend expects the FastAPI backend from the repository root to be running.
- API client code lives in `src/api/`.
- Shared view logic and persistence helpers live in `src/hooks/` and `src/utils/`.
