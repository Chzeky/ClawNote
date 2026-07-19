# ClawNote Web API

FastAPI adapter for the existing SQLite knowledge tools.

## Run

From the repository root:

```bash
source .venv/bin/activate
python3 -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

OpenAPI documentation is available at `http://127.0.0.1:8000/docs`.

## Current endpoints

- `GET /api/health`: service health.
- `GET /api/knowledge?limit=20`: latest knowledge items.
- `GET /api/search?q=RAG&limit=5`: FTS5 search with safe `LIKE` fallback.
- `POST /api/knowledge/text`: parameterized text knowledge storage.
