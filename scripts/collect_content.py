#!/usr/bin/env python3

import argparse
import ipaddress
import json
import os
import socket
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

MAX_RESPONSE_BYTES = 2 * 1024 * 1024
SUPPORTED_FILES = {".txt", ".md"}
FAKE_IP_NETWORK = ipaddress.ip_network("198.18.0.0/15")


class ArticleParser(HTMLParser):
    IGNORED_TAGS = {"script", "style", "noscript", "svg"}
    BLOCK_TAGS = {
        "article", "blockquote", "div", "h1", "h2", "h3", "h4", "h5", "h6",
        "li", "main", "p", "pre", "section", "table", "tr",
    }
    VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self):
        super().__init__()
        self._ignored_depth = 0
        self._in_title = False
        self._content_depth = 0
        self.title_parts = []
        self.all_text_parts = []
        self.content_text_parts = []

    def handle_starttag(self, tag, attrs):
        if self._ignored_depth:
            if tag not in self.VOID_TAGS:
                self._ignored_depth += 1
            return

        attributes = dict(attrs)
        classes = set(attributes.get("class", "").split())
        is_content_root = tag in {"article", "main"} or "markdown" in classes

        if tag in self.IGNORED_TAGS:
            self._ignored_depth = 1
            if tag == "svg" and self._content_depth:
                self.content_text_parts.append("[数学公式]")
            return

        if self._content_depth and tag not in self.VOID_TAGS:
            self._content_depth += 1
        elif is_content_root:
            self._content_depth = 1

        if tag == "title":
            self._in_title = True

    def handle_endtag(self, tag):
        if self._ignored_depth:
            self._ignored_depth -= 1
            return

        if tag == "title":
            self._in_title = False

        if not self._ignored_depth and tag in self.BLOCK_TAGS:
            self.all_text_parts.append("\n")
            if self._content_depth:
                self.content_text_parts.append("\n")
        if self._content_depth and tag not in self.VOID_TAGS:
            self._content_depth -= 1

    def handle_data(self, data):
        text = " ".join(data.split())
        if not text or self._ignored_depth:
            return
        if self._in_title:
            self.title_parts.append(text)
        self.all_text_parts.append(text)
        if self._content_depth:
            self.content_text_parts.append(text)


def normalize_text_parts(parts):
    lines = []
    current = []
    for part in parts:
        if part == "\n":
            line = " ".join(current).strip()
            if line and (not lines or lines[-1] != line):
                lines.append(line)
            current = []
        else:
            current.append(part)
    line = " ".join(current).strip()
    if line and (not lines or lines[-1] != line):
        lines.append(line)
    return "\n".join(lines)


def emit(data):
    print(json.dumps(data, ensure_ascii=False, indent=2))


def result(source_type, source, title, content):
    return {
        "status": "success",
        "source_type": source_type,
        "source": source,
        "title": title.strip() or "未命名知识",
        "content": content.strip(),
        "collected_at": datetime.now(timezone.utc).isoformat(),
    }


def collect_text(args):
    content = args.content.strip()
    if not content:
        raise ValueError("文本内容不能为空")
    return result("text", "user_input", args.title or content[:40], content)


def collect_file(args):
    path = Path(args.path).expanduser().resolve()
    if path.suffix.lower() not in SUPPORTED_FILES:
        raise ValueError("仅支持 .txt 和 .md 文件")
    return collect_uploaded_file(path.name, path.read_bytes(), args.title, str(path))


def collect_uploaded_file(filename, payload, title=None, source=None):
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_FILES:
        raise ValueError("仅支持 .txt 和 .md 文件")
    if len(payload) > MAX_RESPONSE_BYTES:
        raise ValueError("文件内容超过 2 MiB 限制")
    content = payload.decode("utf-8").strip()
    if not content:
        raise ValueError("文件内容不能为空")
    return result(
        "file",
        source or filename,
        title or Path(filename).stem,
        content,
    )


def validate_public_url(url):
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("仅支持有效的 HTTP/HTTPS URL")

    try:
        literal_ip = ipaddress.ip_address(parsed.hostname)
    except ValueError:
        literal_ip = None
    if literal_ip is not None and not literal_ip.is_global:
        raise ValueError("禁止访问本机、内网或保留地址")

    default_port = 443 if parsed.scheme == "https" else 80
    proxy_enabled = bool(
        os.environ.get(f"{parsed.scheme}_proxy")
        or os.environ.get(f"{parsed.scheme.upper()}_PROXY")
    )
    for address in socket.getaddrinfo(parsed.hostname, parsed.port or default_port):
        ip = ipaddress.ip_address(address[4][0])
        if proxy_enabled and ip in FAKE_IP_NETWORK:
            continue
        if not ip.is_global:
            raise ValueError("禁止访问本机、内网或保留地址")


class SafeRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        validate_public_url(new_url)
        return super().redirect_request(
            request,
            file_pointer,
            code,
            message,
            headers,
            new_url,
        )


def extract_html(html):
    parser = ArticleParser()
    parser.feed(html)
    selected_parts = parser.content_text_parts or parser.all_text_parts
    return " ".join(parser.title_parts), normalize_text_parts(selected_parts)


def collect_url(args):
    validate_public_url(args.url)
    request = Request(args.url, headers={"User-Agent": "ClawNote/0.1"})
    opener = build_opener(SafeRedirectHandler())
    with opener.open(request, timeout=args.timeout) as response:
        validate_public_url(response.geturl())
        content_type = response.headers.get_content_type()
        if content_type not in {"text/html", "text/plain", "application/xhtml+xml"}:
            raise ValueError("网址返回的不是可读取网页")
        payload = response.read(MAX_RESPONSE_BYTES + 1)
        if len(payload) > MAX_RESPONSE_BYTES:
            raise ValueError("网页内容超过 2 MiB 限制")
        charset = response.headers.get_content_charset() or "utf-8"
        html = payload.decode(charset, errors="replace")

    title, content = extract_html(html)
    if not content:
        raise ValueError("网页正文为空")
    return result("webpage", args.url, args.title or title, content)


def build_parser():
    parser = argparse.ArgumentParser(description="ClawNote 多源内容采集工具")
    commands = parser.add_subparsers(dest="command", required=True)

    text_parser = commands.add_parser("text")
    text_parser.add_argument("--content", required=True)
    text_parser.add_argument("--title")
    text_parser.set_defaults(function=collect_text)

    file_parser = commands.add_parser("file")
    file_parser.add_argument("--path", required=True)
    file_parser.add_argument("--title")
    file_parser.set_defaults(function=collect_file)

    url_parser = commands.add_parser("url")
    url_parser.add_argument("--url", required=True)
    url_parser.add_argument("--title")
    url_parser.add_argument("--timeout", type=int, default=15)
    url_parser.set_defaults(function=collect_url)
    return parser


def main():
    args = build_parser().parse_args()
    try:
        emit(args.function(args))
    except (OSError, UnicodeError, ValueError) as error:
        emit({"status": "failed", "error": str(error)})
        raise SystemExit(1)


if __name__ == "__main__":
    main()
