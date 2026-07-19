# ClawNote Frontend

React and Vite interface for the ClawNote personal knowledge manager.

## Run

Start the FastAPI service on port `8000`, then run:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The current MVP loads real knowledge items from `GET /api/knowledge`; search, import, QA, graph, and recommendation views are the next UI milestones.
