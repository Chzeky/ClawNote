import unittest

from backend.app.insights import (
    build_learning_path,
    build_graph,
    build_overview,
    jaccard_similarity,
    normalize_category,
    recommend_items,
    suggest_knowledge_gaps,
)


ITEMS = [
    {
        "id": 4,
        "title": "RAG 项目实践",
        "content": "在系统中集成 RAG 问答和引用来源。",
        "summary": "RAG 项目案例。",
        "category": "AI",
        "tags": ["RAG", "实践"],
        "source": "text",
        "source_url": "",
        "created_at": "2026-07-20",
    },
    {
        "id": 3,
        "title": "向量检索优化",
        "content": "向量检索可用于 RAG 召回。",
        "summary": "向量检索进阶优化。",
        "category": "AI",
        "tags": ["向量检索", "优化"],
        "source": "text",
        "source_url": "",
        "created_at": "2026-07-20",
    },
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
        self.assertEqual(overview["total"], 4)
        self.assertEqual(overview["category_count"], 1)
        self.assertEqual(overview["top_tags"][0], {"name": "RAG", "count": 3})

    def test_graph_contains_knowledge_concepts_and_relations(self):
        graph = build_graph(ITEMS)
        node_ids = {node["id"] for node in graph["nodes"]}
        self.assertIn("knowledge:2", node_ids)
        self.assertIn("concept:rag", node_ids)
        self.assertGreater(graph["relation_count"], 0)
        self.assertEqual(graph["categories"][0]["label"], "AI 技术")
        self.assertEqual(graph["categories"][0]["knowledge_count"], 4)

    def test_category_aliases_are_normalized_for_graph_display(self):
        self.assertEqual(normalize_category("AI"), "AI 技术")
        self.assertEqual(normalize_category("AI技术"), "AI 技术")
        self.assertEqual(normalize_category("后端开发"), "软件开发")

    def test_recommendations_use_jaccard_tag_similarity(self):
        result = recommend_items(ITEMS, 2, 5)
        self.assertIsNotNone(result)
        recommended = {item["id"]: item["matched_tags"] for item in result["items"]}
        self.assertEqual(recommended[3], ["向量检索"])
        self.assertEqual(recommended[4], ["RAG"])
        self.assertIn("learning_path", result)
        self.assertIn("gaps", result)

    def test_learning_path_orders_items_by_stage(self):
        source = ITEMS[1]
        path = build_learning_path(ITEMS, source, 4)
        self.assertGreaterEqual(len(path), 3)
        self.assertEqual(path[0]["stage"], "基础")
        self.assertIn(source["id"], {item["id"] for item in path})
        self.assertTrue(all(item["reason"] for item in path))

    def test_gap_suggestions_exclude_existing_tags(self):
        source = ITEMS[2]
        gaps = suggest_knowledge_gaps(ITEMS, source)
        topics = {item["topic"] for item in gaps}
        self.assertIn("Embedding", topics)
        self.assertNotIn("向量检索", topics)

    def test_jaccard_matching_is_case_insensitive(self):
        similarity, matched = jaccard_similarity(["RAG", "SQLite"], ["rag"])
        self.assertEqual(similarity, 0.5)
        self.assertEqual(matched, ["RAG"])


if __name__ == "__main__":
    unittest.main()
