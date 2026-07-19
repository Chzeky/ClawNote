import unittest

from backend.app.insights import (
    build_graph,
    build_overview,
    jaccard_similarity,
    normalize_category,
    recommend_items,
)


ITEMS = [
    {
        "id": 2,
        "title": "混合检索",
        "content": "RAG 同时使用关键词检索和向量检索。",
        "summary": "混合检索提高召回质量。",
        "category": "AI",
        "tags": ["RAG", "向量检索", "关键词检索"],
        "source": "webpage",
        "source_url": "https://example.com/rag",
        "created_at": "2026-07-19",
    },
    {
        "id": 1,
        "title": "RAG 基础",
        "content": "RAG 通过知识检索增强回答。",
        "summary": "RAG 基础概念。",
        "category": "AI",
        "tags": ["RAG", "知识检索"],
        "source": "text",
        "source_url": "",
        "created_at": "2026-07-18",
    },
]


class InsightTests(unittest.TestCase):
    def test_overview_counts_categories_sources_and_tags(self):
        overview = build_overview(ITEMS)
        self.assertEqual(overview["total"], 2)
        self.assertEqual(overview["category_count"], 1)
        self.assertEqual(overview["top_tags"][0], {"name": "RAG", "count": 2})

    def test_graph_contains_knowledge_concepts_and_relations(self):
        graph = build_graph(ITEMS)
        node_ids = {node["id"] for node in graph["nodes"]}
        self.assertIn("knowledge:2", node_ids)
        self.assertIn("concept:rag", node_ids)
        self.assertGreater(graph["relation_count"], 0)
        self.assertEqual(graph["categories"][0]["label"], "AI 技术")
        self.assertEqual(graph["categories"][0]["knowledge_count"], 2)

    def test_category_aliases_are_normalized_for_graph_display(self):
        self.assertEqual(normalize_category("AI"), "AI 技术")
        self.assertEqual(normalize_category("AI技术"), "AI 技术")
        self.assertEqual(normalize_category("后端开发"), "软件开发")

    def test_recommendations_use_jaccard_tag_similarity(self):
        result = recommend_items(ITEMS, 2, 5)
        self.assertIsNotNone(result)
        self.assertEqual(result["items"][0]["id"], 1)
        self.assertEqual(result["items"][0]["matched_tags"], ["RAG"])

    def test_jaccard_matching_is_case_insensitive(self):
        similarity, matched = jaccard_similarity(["RAG", "SQLite"], ["rag"])
        self.assertEqual(similarity, 0.5)
        self.assertEqual(matched, ["RAG"])


if __name__ == "__main__":
    unittest.main()
