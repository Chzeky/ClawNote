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
- `POST /api/qa`: retrieve local evidence and ask the qa Agent for a grounded answer with citations.
- `POST /api/knowledge/text`: parameterized text knowledge storage.
- `POST /api/knowledge/analyze`: isolated organizer Agent draft generation without storage.
- `POST /api/collect/url`: safely collect public webpage text without storage.
- `POST /api/collect/file`: extract an uploaded UTF-8 TXT/Markdown file without storage.
- `GET /api/knowledge/{id}`: complete knowledge detail.
- `PATCH /api/knowledge/{id}`: partial title, content, summary, category, or tag update.
- `DELETE /api/knowledge/{id}`: delete one knowledge item and its synchronized FTS row.

Organizer drafts use a bounded in-memory LRU cache keyed by content and title hint. The cache contains no API credentials and is cleared when the backend restarts.

The QA endpoint performs deterministic SQLite evidence retrieval before invoking `clawnote-qa`. Questions and evidence are passed as untrusted JSON data, model output is strictly validated, and citation metadata is always controlled by the backend. If no evidence is found, the endpoint returns a refusal without invoking the model.
