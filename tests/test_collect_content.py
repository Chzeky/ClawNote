import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

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

    def test_collect_uploaded_markdown(self):
        item = collect_content.collect_uploaded_file(
            "vector-note.md",
            "# 向量检索\n通过语义相似度查找知识。".encode("utf-8"),
        )
        self.assertEqual("vector-note", item["title"])
        self.assertEqual("vector-note.md", item["source"])

    def test_rejects_unsupported_uploaded_file(self):
        with self.assertRaises(ValueError):
            collect_content.collect_uploaded_file("secret.exe", b"binary")

    def test_rejects_uploaded_file_over_10_mib(self):
        payload = b"x" * (collect_content.MAX_UPLOAD_BYTES + 1)
        with self.assertRaisesRegex(ValueError, "10 MiB"):
            collect_content.collect_uploaded_file("large-note.txt", payload)

    def test_extract_html_ignores_script_and_style(self):
        title, content = collect_content.extract_html(
            "<html><head><title>文章</title><style>bad</style></head>"
            "<body><h1>知识标题</h1><p>正文内容</p><script>bad()</script></body></html>"
        )
        self.assertEqual("文章", title)
        self.assertIn("正文内容", content)
        self.assertNotIn("bad()", content)

    def test_extract_html_uses_main_content_and_collapses_math_svg(self):
        title, content = collect_content.extract_html(
            "<html><head><title>课程</title></head><body>"
            "<nav>重复导航</nav><div class='markdown'><p>公式如下：</p>"
            "<div class='math'><svg><text>下</text><text>一</text>"
            "<text>状</text><text>态</text></svg></div>"
            "<p>根据公式继续分析。</p></div></body></html>"
        )
        self.assertEqual(title, "课程")
        self.assertNotIn("重复导航", content)
        self.assertIn("[数学公式]", content)
        self.assertNotIn("下\n一\n状\n态", content)
        self.assertIn("根据公式继续分析。", content)

    def test_rejects_loopback_url(self):
        with self.assertRaises(ValueError):
            collect_content.validate_public_url("http://127.0.0.1/private")

    def test_rejects_redirect_to_loopback(self):
        handler = collect_content.SafeRedirectHandler()
        with self.assertRaises(ValueError):
            handler.redirect_request(
                None,
                None,
                302,
                "Found",
                {},
                "http://127.0.0.1/private",
            )

    def test_preserves_https_for_same_host_downgrade_redirect(self):
        handler = collect_content.SafeRedirectHandler()
        request = collect_content.Request("https://example.com/article")
        with patch.object(collect_content, "validate_public_url") as validate:
            redirected = handler.redirect_request(
                request,
                None,
                301,
                "Moved Permanently",
                {},
                "http://example.com/article/",
            )

        self.assertEqual("https://example.com/article/", redirected.full_url)
        validate.assert_called_once_with("https://example.com/article/")

    def test_allows_proxy_fake_ip_for_domain_name(self):
        fake_result = [(2, 1, 6, "", ("198.18.0.10", 443))]
        with patch.dict("os.environ", {"HTTPS_PROXY": "http://127.0.0.1:6789"}), \
                patch("socket.getaddrinfo", return_value=fake_result):
            collect_content.validate_public_url("https://example.com/article")


if __name__ == "__main__":
    unittest.main()
