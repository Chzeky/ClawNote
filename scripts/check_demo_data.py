#!/usr/bin/env python3
"""Print a compact quality check for the current demo database."""

from __future__ import annotations

import json
import sqlite3
import sys
from collections import Counter
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = PROJECT_ROOT / "data" / "clawnote.db"
sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.insights import build_graph, normalize_item, recommend_items


def main() -> None:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        """
        SELECT id, title, content, summary, category, tags, source, source_url, content_type, created_at
        FROM knowledge_items
        ORDER BY id
        """
    ).fetchall()
    items = [normalize_item(row) for row in rows]
    categories = Counter(item["category"] for item in items)
    tags = Counter(tag for item in items for tag in item["tags"])
    graph = build_graph(items)
    recommendations = recommend_items(items, 1, 6)
    payload = {
        "count": len(items),
        "categories": categories,
        "top_tags": tags.most_common(12),
        "graph": {
            "knowledge_count": graph["knowledge_count"],
            "concept_count": graph["concept_count"],
            "relation_count": graph["relation_count"],
            "categories": graph["categories"],
        },
        "recommendation_source": recommendations["source"] if recommendations else None,
        "learning_path": recommendations["learning_path"] if recommendations else [],
        "gaps": recommendations["gaps"] if recommendations else [],
        "items": [
            {
                "id": item["id"],
                "title": item["title"],
                "category": item["category"],
                "tags": item["tags"],
                "source": item["source"],
                "content_type": item["content_type"],
            }
            for item in items
        ],
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
