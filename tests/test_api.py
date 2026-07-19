import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

import httpx

from backend.app.main import app


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
            },
        )
        self.assertEqual(create_response.status_code, 201)
        knowledge_id = create_response.json()["knowledge_id"]

        detail_response = await self.client.get(f"/api/knowledge/{knowledge_id}")
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.json()["item"]["tags"], ["FastAPI", "CRUD"])

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


if __name__ == "__main__":
    unittest.main()
