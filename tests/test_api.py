import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

import httpx

from backend.app.main import app
from backend.app.organizer import KnowledgeDraft


PROJECT_ROOT = Path(__file__).resolve().parents[1]
INIT_SQL_PATH = PROJECT_ROOT / "database" / "init.sql"


class KnowledgeApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "api-test.db"

        with closing(self._connect()) as connection:
            connection.executescript(INIT_SQL_PATH.read_text(encoding="utf-8"))

        self.connect_patcher = patch(
            "backend.app.main.connect",
            side_effect=self._connect,
        )
        self.connect_patcher.start()
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        )

    async def asyncTearDown(self):
        await self.client.aclose()
        self.connect_patcher.stop()
        self.temp_dir.cleanup()

    def _connect(self):
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    async def test_create_get_update_delete_lifecycle(self):
        create_response = await self.client.post(
            "/api/knowledge/text",
            json={
                "title": "API lifecycle",
                "content": "Temporary API test content.",
                "category": "test",
                "tags": ["FastAPI", "CRUD"],
                "source": "webpage",
                "source_url": "https://example.com/article",
                "content_type": "webpage",
            },
        )
        self.assertEqual(create_response.status_code, 201)
        knowledge_id = create_response.json()["knowledge_id"]

        detail_response = await self.client.get(f"/api/knowledge/{knowledge_id}")
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.json()["item"]["tags"], ["FastAPI", "CRUD"])
        self.assertEqual(
            detail_response.json()["item"]["source_url"],
            "https://example.com/article",
        )

        update_response = await self.client.patch(
            f"/api/knowledge/{knowledge_id}",
            json={
                "summary": "Updated through PATCH.",
                "tags": ["FastAPI", "updated"],
            },
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertTrue(update_response.json()["updated"])
        self.assertEqual(update_response.json()["item"]["summary"], "Updated through PATCH.")

        delete_response = await self.client.delete(f"/api/knowledge/{knowledge_id}")
        self.assertEqual(delete_response.status_code, 200)
        self.assertTrue(delete_response.json()["deleted"])
        missing_response = await self.client.get(f"/api/knowledge/{knowledge_id}")
        self.assertEqual(missing_response.status_code, 404)

    async def test_rejects_empty_update_and_missing_items(self):
        empty_update = await self.client.patch("/api/knowledge/999", json={})
        missing_get = await self.client.get("/api/knowledge/999")
        missing_delete = await self.client.delete("/api/knowledge/999")
        self.assertEqual(empty_update.status_code, 422)
        self.assertEqual(missing_get.status_code, 404)
        self.assertEqual(missing_delete.status_code, 404)

    async def test_analyze_returns_organizer_draft_without_storing(self):
        draft = KnowledgeDraft(
            title="RAG 检索增强生成",
            summary="RAG 通过外部知识检索提高回答准确性。",
            category="AI 技术",
            tags=["RAG", "知识检索", "大模型"],
        )
        with patch(
            "backend.app.main.analyze_knowledge_draft",
            return_value=draft,
        ) as analyze_mock:
            response = await self.client.post(
                "/api/knowledge/analyze",
                json={
                    "content": "RAG 通过检索知识库内容来增强大模型回答的准确性。",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), draft.model_dump())
        analyze_mock.assert_awaited_once()
        with closing(self._connect()) as connection:
            count = connection.execute(
                "SELECT COUNT(*) FROM knowledge_items"
            ).fetchone()[0]
        self.assertEqual(count, 0)

    async def test_analyze_rejects_too_short_content(self):
        response = await self.client.post(
            "/api/knowledge/analyze",
            json={"content": "内容太短"},
        )
        self.assertEqual(response.status_code, 422)

    async def test_collect_uploaded_markdown(self):
        response = await self.client.post(
            "/api/collect/file",
            files={
                "file": (
                    "rag-note.md",
                    "# RAG\n检索增强生成通过外部知识提高回答准确性。".encode("utf-8"),
                    "text/markdown",
                ),
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["title"], "rag-note")
        self.assertEqual(response.json()["source_type"], "file")
        self.assertFalse(response.json()["truncated"])

    async def test_collect_url_rejects_loopback(self):
        response = await self.client.post(
            "/api/collect/url",
            json={"url": "http://127.0.0.1/private"},
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
