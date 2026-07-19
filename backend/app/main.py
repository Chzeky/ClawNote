import json
import sqlite3
from contextlib import closing

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

    with closing(connect()) as connection:
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

    with closing(connect()) as connection:
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

    with closing(connect()) as connection:
        cursor = connection.execute(sql, values)
        connection.commit()
        knowledge_id = cursor.lastrowid

    return {
        "success": True,
        "stored": True,
        "knowledge_id": knowledge_id,
    }


class KnowledgeUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
    )
    content: str | None = Field(default=None, min_length=1)
    summary: str | None = None
    category: str | None = Field(default=None, min_length=1)
    tags: list[str] | None = Field(default=None, max_length=10)


def serialize_knowledge(row):
    item = dict(row)
    item["tags"] = json.loads(item["tags"] or "[]")
    return item


@app.get("/api/knowledge/{knowledge_id}")
def get_knowledge_item(knowledge_id: int):
    sql = """
        SELECT *
        FROM knowledge_items
        WHERE id = ?
    """

    with closing(connect()) as connection:
        row = connection.execute(
            sql,
            (knowledge_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="知识条目不存在",
        )

    return {
        "success": True,
        "item": serialize_knowledge(row),
    }


@app.patch("/api/knowledge/{knowledge_id}")
def update_knowledge_item(
    knowledge_id: int,
    payload: KnowledgeUpdate,
):
    changes = payload.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=422,
            detail="至少需要提供一个修改字段",
        )

    for field in ("title", "content", "category"):
        if field in changes:
            value = changes[field]

            if value is None or not value.strip():
                raise HTTPException(
                    status_code=422,
                    detail=f"{field} 不能为空",
                )

            changes[field] = value.strip()

    if "summary" in changes:
        changes["summary"] = (changes["summary"] or "").strip()

    if "tags" in changes:
        tags = changes["tags"]

        if tags is None:
            raise HTTPException(
                status_code=422,
                detail="tags 不能为 null",
            )

        normalized_tags = [
            tag.strip()
            for tag in tags
            if tag.strip()
        ]
        changes["tags"] = json.dumps(
            normalized_tags,
            ensure_ascii=False,
        )

    set_clause = ", ".join(
        f"{field} = ?"
        for field in changes
    )
    values = [*changes.values(), knowledge_id]

    with closing(connect()) as connection:
        cursor = connection.execute(
            f"""
                UPDATE knowledge_items
                SET {set_clause}
                WHERE id = ?
            """,
            values,
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="知识条目不存在",
            )

        row = connection.execute(
            "SELECT * FROM knowledge_items WHERE id = ?",
            (knowledge_id,),
        ).fetchone()
        connection.commit()

    return {
        "success": True,
        "updated": True,
        "item": serialize_knowledge(row),
    }


@app.delete("/api/knowledge/{knowledge_id}")
def delete_knowledge_item(knowledge_id: int):
    with closing(connect()) as connection:
        cursor = connection.execute(
            """
                DELETE FROM knowledge_items
                WHERE id = ?
            """,
            (knowledge_id,),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="知识条目不存在",
            )
        connection.commit()

    return {
        "success": True,
        "deleted": True,
        "knowledge_id": knowledge_id,
    }
