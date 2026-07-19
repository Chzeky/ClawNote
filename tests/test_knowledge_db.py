import contextlib
import io
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

import knowledge_db


class KnowledgeDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = knowledge_db.DB_PATH
        self.original_init_path = knowledge_db.INIT_SQL_PATH
        knowledge_db.DB_PATH = Path(self.temp_dir.name) / "clawnote-test.db"
        knowledge_db.INIT_SQL_PATH = PROJECT_ROOT / "database" / "init.sql"
        self.capture(knowledge_db.init_database, SimpleNamespace())

    def tearDown(self):
        knowledge_db.DB_PATH = self.original_db_path
        knowledge_db.INIT_SQL_PATH = self.original_init_path
        self.temp_dir.cleanup()

    @staticmethod
    def capture(function, args):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            function(args)
        return json.loads(output.getvalue())

    @staticmethod
    def entry(title="RAG 基础", content="RAG 通过知识库检索增强回答。"):
        return SimpleNamespace(
            title=title,
            content=content,
            summary="使用外部知识增强回答。",
            category="AI 技术",
            tag=["RAG", "知识检索"],
            source="自动测试",
            source_url="",
            content_type="text",
        )

    def test_init_creates_tables(self):
        with sqlite3.connect(knowledge_db.DB_PATH) as connection:
            names = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type IN ('table', 'view')"
                )
            }
        self.assertIn("knowledge_items", names)
        self.assertIn("knowledge_fts", names)

    def test_add_and_get_knowledge(self):
        added = self.capture(knowledge_db.add_knowledge, self.entry())
        fetched = self.capture(
            knowledge_db.get_knowledge,
            SimpleNamespace(id=added["knowledge_id"]),
        )
        self.assertTrue(added["stored"])
        self.assertEqual("RAG 基础", fetched["item"]["title"])

    def test_full_text_search(self):
        self.capture(knowledge_db.add_knowledge, self.entry())
        result = self.capture(
            knowledge_db.search_knowledge,
            SimpleNamespace(query="RAG", limit=5),
        )
        self.assertEqual(1, result["count"])
        self.assertEqual("fts5", result["search_mode"])
        self.assertEqual("RAG 基础", result["items"][0]["title"])

    def test_chinese_query_uses_safe_like_fallback(self):
        self.capture(
            knowledge_db.add_knowledge,
            self.entry(
                title="混合检索",
                content="关键词检索与向量检索可以结合使用。",
            ),
        )
        result = self.capture(
            knowledge_db.search_knowledge,
            SimpleNamespace(query="向量检索", limit=5),
        )
        self.assertEqual(1, result["count"])
        self.assertEqual("like_fallback", result["search_mode"])
        self.assertEqual("混合检索", result["items"][0]["title"])

    def test_parameterized_insert_blocks_sql_injection(self):
        malicious_title = "x'); DROP TABLE knowledge_items; --"
        self.capture(
            knowledge_db.add_knowledge,
            self.entry(title=malicious_title),
        )
        with sqlite3.connect(knowledge_db.DB_PATH) as connection:
            count = connection.execute(
                "SELECT COUNT(*) FROM knowledge_items"
            ).fetchone()[0]
        self.assertEqual(1, count)


if __name__ == "__main__":
    unittest.main()
