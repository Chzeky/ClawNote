# organize-knowledge

Stores content already summarized, categorized, and tagged by the organizer Agent. The Skill invokes `knowledge_db.py add` with an argument array; it never builds SQL or a shell command from user input.

Configuration is isolated in `config.json`. `storeOrganizedKnowledge()` validates required fields and returns a typed `knowledge_id` only after the database confirms `stored: true`.
