import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

import collect_content


class CollectContentTests(unittest.TestCase):
    def test_collect_text(self):
        item = collect_content.collect_text(
            SimpleNamespace(title="测试笔记", content="一条可采集的知识。")
        )
        self.assertEqual("success", item["status"])
        self.assertEqual("text", item["source_type"])
        self.assertEqual("测试笔记", item["title"])

    def test_collect_markdown_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "note.md"
            path.write_text("# RAG\n检索增强生成。", encoding="utf-8")
            item = collect_content.collect_file(
                SimpleNamespace(path=str(path), title=None)
            )
        self.assertEqual("file", item["source_type"])
        self.assertIn("检索增强生成", item["content"])

    def test_extract_html_ignores_script_and_style(self):
        title, content = collect_content.extract_html(
            "<html><head><title>文章</title><style>bad</style></head>"
            "<body><h1>知识标题</h1><p>正文内容</p><script>bad()</script></body></html>"
        )
        self.assertEqual("文章", title)
        self.assertIn("正文内容", content)
        self.assertNotIn("bad()", content)

    def test_rejects_loopback_url(self):
        with self.assertRaises(ValueError):
            collect_content.validate_public_url("http://127.0.0.1/private")


if __name__ == "__main__":
    unittest.main()
