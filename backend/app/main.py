import json
import sqlite3

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from scripts.knowledge_db import connect


class TextKnowledgeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    summary: str = ""
    category: str = "未分类"
    tags: list[str] = Field(default_factory=list)


app = FastAPI(
    title="ClawNote API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "clawnote-api",
    }


@app.get("/api/knowledge")
def list_knowledge(
    limit: int = Query(default=20, ge=1, le=100),
):
    sql = """
        SELECT id, title, category, tags, source, created_at
        FROM knowledge_items
        ORDER BY id DESC
        LIMIT ?
    """

    with connect() as connection:
        rows = connection.execute(sql, (limit,)).fetchall()

    items = []

    for row in rows:
        item = dict(row)
        item["tags"] = json.loads(item["tags"] or "[]")
        items.append(item)

    return {
        "success": True,
        "count": len(items),
        "items": items,
    }


@app.get("/api/search")
def search_knowledge(
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(default=5, ge=1, le=50),
):
    query = q.strip()

    if not query:
        raise HTTPException(
            status_code=422,
            detail="搜索关键词不能为空",
        )

    fts_sql = """
        SELECT k.id, k.title, k.summary, k.category,
               k.tags, k.source, k.source_url, k.content
        FROM knowledge_fts
        JOIN knowledge_items AS k
          ON k.id = knowledge_fts.rowid
        WHERE knowledge_fts MATCH ?
        ORDER BY bm25(knowledge_fts)
        LIMIT ?
    """

    with connect() as connection:
        try:
            rows = connection.execute(
                fts_sql,
                (query, limit),
            ).fetchall()
        except sqlite3.OperationalError:
            rows = []

        search_mode = "fts5"

        if not rows:
            escaped = (
                query.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
            )
            pattern = f"%{escaped}%"

            like_sql = """
                SELECT id, title, summary, category,
                       tags, source, source_url, content
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
                (pattern, pattern, pattern, pattern, limit),
            ).fetchall()
            search_mode = "like_fallback"

    items = []

    for row in rows:
        item = dict(row)
        item["tags"] = json.loads(item["tags"] or "[]")
        items.append(item)

    return {
        "success": True,
        "query": query,
        "search_mode": search_mode,
        "count": len(items),
        "items": items,
    }


@app.post("/api/knowledge/text", status_code=201)
def create_text_knowledge(payload: TextKnowledgeCreate):
    title = payload.title.strip()
    content = payload.content.strip()

    if not title or not content:
        raise HTTPException(
            status_code=422,
            detail="标题和正文不能为空",
        )

    sql = """
        INSERT INTO knowledge_items (
            title, content, summary, category,
            tags, source, source_url, content_type
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """

    values = (
        title,
        content,
        payload.summary.strip(),
        payload.category.strip() or "未分类",
        json.dumps(payload.tags, ensure_ascii=False),
        "web_frontend",
        "",
        "text",
    )

    with connect() as connection:
        cursor = connection.execute(sql, values)
        knowledge_id = cursor.lastrowid

    return {
        "success": True,
        "stored": True,
        "knowledge_id": knowledge_id,
    }
