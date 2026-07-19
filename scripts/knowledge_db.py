#!/usr/bin/env python3

import argparse
import json
import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = PROJECT_ROOT / "data" / "clawnote.db"
INIT_SQL_PATH = PROJECT_ROOT / "database" / "init.sql"


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 5000")
    return connection


def print_json(data):
    print(json.dumps(data, ensure_ascii=False, indent=2))


def init_database(_args):
    if not INIT_SQL_PATH.exists():
        raise FileNotFoundError(f"找不到初始化文件：{INIT_SQL_PATH}")

    with connect() as connection:
        connection.executescript(INIT_SQL_PATH.read_text(encoding="utf-8"))

    print_json({
        "success": True,
        "database": str(DB_PATH),
        "message": "数据库初始化成功"
    })


def add_knowledge(args):
    tags_json = json.dumps(args.tag or [], ensure_ascii=False)

    sql = """
        INSERT INTO knowledge_items (
            title,
            content,
            summary,
            category,
            tags,
            source,
            source_url,
            content_type
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """

    values = (
        args.title,
        args.content,
        args.summary,
        args.category,
        tags_json,
        args.source,
        args.source_url,
        args.content_type,
    )

    with connect() as connection:
        cursor = connection.execute(sql, values)
        knowledge_id = cursor.lastrowid

    print_json({
        "success": True,
        "knowledge_id": knowledge_id,
        "stored": True
    })


def search_knowledge(args):
    fts_sql = """
        SELECT
            k.id,
            k.title,
            k.summary,
            k.category,
            k.tags,
            k.source,
            k.source_url,
            k.content
        FROM knowledge_fts
        JOIN knowledge_items AS k
            ON k.id = knowledge_fts.rowid
        WHERE knowledge_fts MATCH ?
        ORDER BY bm25(knowledge_fts)
        LIMIT ?
    """

    with connect() as connection:
        rows = connection.execute(
            fts_sql,
            (args.query, args.limit)
        ).fetchall()
        search_mode = "fts5"

        if not rows:
            escaped_query = (
                args.query
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
            )
            pattern = f"%{escaped_query}%"
            like_sql = """
                SELECT
                    id,
                    title,
                    summary,
                    category,
                    tags,
                    source,
                    source_url,
                    content
                FROM knowledge_items
                WHERE title LIKE ? ESCAPE '\\'
                   OR content LIKE ? ESCAPE '\\'
                   OR summary LIKE ? ESCAPE '\\'
                   OR tags LIKE ? ESCAPE '\\'
                ORDER BY id DESC
                LIMIT ?
            """
            rows = connection.execute(
                like_sql,
                (pattern, pattern, pattern, pattern, args.limit),
            ).fetchall()
            search_mode = "like_fallback"

    print_json({
        "success": True,
        "query": args.query,
        "search_mode": search_mode,
        "count": len(rows),
        "items": [dict(row) for row in rows]
    })


def get_knowledge(args):
    sql = """
        SELECT *
        FROM knowledge_items
        WHERE id = ?
    """

    with connect() as connection:
        row = connection.execute(sql, (args.id,)).fetchone()

    print_json({
        "success": True,
        "item": dict(row) if row else None
    })


def list_knowledge(args):
    sql = """
        SELECT id, title, category, tags, source, created_at
        FROM knowledge_items
        ORDER BY id DESC
        LIMIT ?
    """

    with connect() as connection:
        rows = connection.execute(sql, (args.limit,)).fetchall()

    print_json({
        "success": True,
        "count": len(rows),
        "items": [dict(row) for row in rows]
    })


def build_parser():
    parser = argparse.ArgumentParser(
        description="ClawNote 知识库管理工具"
    )
    commands = parser.add_subparsers(dest="command", required=True)

    init_parser = commands.add_parser("init")
    init_parser.set_defaults(function=init_database)

    add_parser = commands.add_parser("add")
    add_parser.add_argument("--title", required=True)
    add_parser.add_argument("--content", required=True)
    add_parser.add_argument("--summary", default="")
    add_parser.add_argument("--category", default="未分类")
    add_parser.add_argument("--tag", action="append")
    add_parser.add_argument("--source", default="用户输入")
    add_parser.add_argument("--source-url", default="")
    add_parser.add_argument("--content-type", default="text")
    add_parser.set_defaults(function=add_knowledge)

    search_parser = commands.add_parser("search")
    search_parser.add_argument("--query", required=True)
    search_parser.add_argument("--limit", type=int, default=5)
    search_parser.set_defaults(function=search_knowledge)

    get_parser = commands.add_parser("get")
    get_parser.add_argument("--id", type=int, required=True)
    get_parser.set_defaults(function=get_knowledge)

    list_parser = commands.add_parser("list")
    list_parser.add_argument("--limit", type=int, default=20)
    list_parser.set_defaults(function=list_knowledge)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    try:
        args.function(args)
    except (sqlite3.Error, OSError, ValueError) as error:
        print_json({
            "success": False,
            "error": str(error)
        })
        raise SystemExit(1)


if __name__ == "__main__":
    main()
