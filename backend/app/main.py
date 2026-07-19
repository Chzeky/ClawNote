import json
import sqlite3
from contextlib import closing
from types import SimpleNamespace
from typing import Literal

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from backend.app.organizer import (
    CONFIG,
    KnowledgeDraft,
    OrganizerAnalysisError,
    analyze_knowledge_draft,
)
from backend.app.insights import (
    build_graph,
    build_overview,
    normalize_item,
    recommend_items,
)
from backend.app.qa import QaGenerationError, QaResponse, answer_question
from backend.app.steward import StewardDispatchError, answer_via_steward
from scripts import collect_content
from scripts.knowledge_db import connect


class TextKnowledgeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    summary: str = ""
    category: str = "未分类"
    tags: list[str] = Field(default_factory=list)
    source: str = Field(default="web_frontend", max_length=200)
    source_url: str = Field(default="", max_length=2000)
    content_type: str = Field(default="text", max_length=50)


class AnalyzeKnowledgeRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    content: str = Field(min_length=20, max_length=20000)
    title_hint: str | None = Field(default=None, max_length=200)


class QuestionRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    question: str = Field(min_length=2, max_length=500)
    mode: Literal["direct", "steward"] = "direct"


class UrlCollectRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    url: str = Field(min_length=8, max_length=2000)


class CollectedContent(BaseModel):
    title: str
    content: str
    source_type: str
    source: str
    truncated: bool


def collected_response(result: dict) -> CollectedContent:
    max_chars = int(CONFIG["maxInputChars"])
    content = result["content"]
    return CollectedContent(
        title=result["title"],
        content=content[:max_chars],
        source_type=result["source_type"],
        source=result["source"],
        truncated=len(content) > max_chars,
    )


def load_insight_items(limit: int = 100) -> list[dict]:
    sql = """
        SELECT id, title, content, summary, category, tags,
               source, source_url, created_at
        FROM knowledge_items
        ORDER BY id DESC
        LIMIT ?
    """
    with closing(connect()) as connection:
        rows = connection.execute(sql, (limit,)).fetchall()
    return [normalize_item(row) for row in rows]


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


@app.get("/api/overview")
def knowledge_overview():
    return build_overview(load_insight_items())


@app.get("/api/graph")
def knowledge_graph(limit: int = Query(default=30, ge=1, le=100)):
    return build_graph(load_insight_items(limit))


@app.get("/api/recommendations")
def knowledge_recommendations(
    knowledge_id: int = Query(ge=1),
    limit: int = Query(default=5, ge=1, le=20),
):
    result = recommend_items(load_insight_items(), knowledge_id, limit)
    if result is None:
        raise HTTPException(status_code=404, detail="知识条目不存在")
    return result


@app.post("/api/knowledge/analyze", response_model=KnowledgeDraft)
async def analyze_knowledge(payload: AnalyzeKnowledgeRequest):
    try:
        return await analyze_knowledge_draft(
            payload.content.strip(),
            payload.title_hint,
        )
    except OrganizerAnalysisError as error:
        raise HTTPException(
            status_code=502,
            detail="AI 整理失败，请检查 OpenClaw 和模型连接后重试",
        ) from error


@app.post("/api/qa", response_model=QaResponse)
async def ask_knowledge_base(payload: QuestionRequest):
    try:
        if payload.mode == "steward":
            return await answer_via_steward(payload.question)
        return await answer_question(payload.question)
    except StewardDispatchError as error:
        raise HTTPException(
            status_code=502,
            detail="Agent 调度失败，请检查 steward、OpenClaw 和模型连接后重试",
        ) from error
    except QaGenerationError as error:
        raise HTTPException(
            status_code=502,
            detail="知识问答生成失败，请检查 OpenClaw 和模型连接后重试",
        ) from error


@app.post("/api/collect/url", response_model=CollectedContent)
def collect_url(payload: UrlCollectRequest):
    try:
        result = collect_content.collect_url(SimpleNamespace(
            url=payload.url,
            title=None,
            timeout=15,
        ))
        return collected_response(result)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (OSError, UnicodeError) as error:
        raise HTTPException(
            status_code=502,
            detail="网页抓取失败，请检查网址和网络连接",
        ) from error


@app.post("/api/collect/file", response_model=CollectedContent)
async def collect_file(file: UploadFile = File(...)):
    filename = file.filename or "upload.txt"
    try:
        payload = await file.read(collect_content.MAX_UPLOAD_BYTES + 1)
        result = collect_content.collect_uploaded_file(filename, payload)
        return collected_response(result)
    except (UnicodeError, ValueError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    finally:
        await file.close()


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
        payload.source.strip() or "web_frontend",
        payload.source_url.strip(),
        payload.content_type.strip() or "text",
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
