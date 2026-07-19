# knowledge-qa

Retrieves evidence from the SQLite knowledge base and returns citation-ready context. It does not invent an answer when retrieval is empty and does not claim to perform vector search.

`answerFromKnowledge()` accepts a user-facing question plus an optional concise retrieval query. The OpenClaw qa Agent may turn the returned evidence into natural language, but every claim must retain the provided knowledge citation.
