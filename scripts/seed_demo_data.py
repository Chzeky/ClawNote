#!/usr/bin/env python3
"""Backup the current ClawNote database and seed cohesive demo knowledge."""

from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = PROJECT_ROOT / "data" / "clawnote.db"
BACKUP_DIR = PROJECT_ROOT / "data" / "backups"
DEMO_SOURCE_DIR = PROJECT_ROOT / "docs" / "demo-sources"
INIT_SQL_PATH = PROJECT_ROOT / "database" / "init.sql"


DEMO_ITEMS = [
    {
        "title": "RAG 基础概念：让大模型回答有来源",
        "category": "AI 技术",
        "tags": ["RAG", "大模型", "知识检索", "引用来源", "基础"],
        "source": "粘贴文本演示",
        "source_url": "",
        "content_type": "text",
        "summary": "RAG 通过先检索知识库、再生成回答的方式，让大模型回答可以回到具体来源。",
        "content": """
RAG 是 Retrieval-Augmented Generation 的缩写，核心思路是在生成回答前先检索外部知识。
普通大模型只依赖训练参数，容易在细节上产生幻觉；RAG 会把知识库中的相关片段作为证据交给模型。
在 ClawNote 中，用户保存的笔记、网页和文件会进入 SQLite 知识库，问答时系统先检索相关知识，再要求模型只基于证据回答。
这让回答可以附带“知识 #编号：标题”的引用，便于用户核验来源。
RAG 的基本流程包括：问题解析、关键词或语义检索、证据筛选、回答生成、引用展示。
""",
    },
    {
        "title": "Embedding 入门：把文本变成可比较的向量",
        "category": "AI 技术",
        "tags": ["Embedding", "语义检索", "向量检索", "RAG", "基础"],
        "source": "粘贴文本演示",
        "source_url": "",
        "content_type": "text",
        "summary": "Embedding 将文本映射到向量空间，使系统可以根据语义相似度检索知识。",
        "content": """
Embedding 是把文本、图片或其他对象编码成向量的技术。
在知识管理场景中，两段文字如果语义相近，它们的向量距离也应当更近。
RAG 系统可以使用 Embedding 做语义检索，弥补关键词检索无法处理同义表达的问题。
例如“知识来源”和“引用依据”在字面上不同，但在语义上高度相关。
ClawNote 当前以 SQLite FTS5 和 LIKE 兜底为主，后续可以增加 Embedding 与向量数据库，让问答召回更稳定。
""",
    },
    {
        "title": "向量数据库：语义检索的基础设施",
        "category": "AI 技术",
        "tags": ["向量数据库", "Embedding", "语义检索", "RAG", "基础"],
        "source": "网页导入演示",
        "source_url": "https://example.com/vector-database-demo",
        "content_type": "webpage",
        "summary": "向量数据库负责存储和查询 Embedding，是语义检索和大规模 RAG 的常见基础设施。",
        "content": """
向量数据库用于保存高维向量，并支持按照距离或相似度快速查找近邻。
当知识库规模变大时，直接遍历所有向量成本较高，向量数据库会通过索引结构提升查询效率。
在 RAG 中，向量数据库通常保存文档切片的 Embedding，用户提问后也会被编码为向量，再检索最相关的切片。
常见能力包括向量写入、近似最近邻搜索、元数据过滤、批量更新和索引重建。
ClawNote 如果引入向量数据库，可以把关键词检索与语义检索组合起来，形成混合检索。
""",
    },
    {
        "title": "SQLite FTS5 基础：本地全文检索",
        "category": "检索系统",
        "tags": ["SQLite", "FTS5", "全文检索", "关键词检索", "基础"],
        "source": "Markdown 文件演示",
        "source_url": "docs/demo-sources/sqlite-fts5.md",
        "content_type": "file",
        "summary": "SQLite FTS5 提供轻量本地全文检索，适合个人知识库的零服务部署。",
        "content": """
SQLite FTS5 是 SQLite 内置的全文检索扩展，可以为标题、正文、摘要和标签建立倒排索引。
ClawNote 选择 SQLite 的原因是部署简单、便于答辩演示，并且可以通过触发器保持知识表和 FTS 表同步。
FTS5 适合英文和空格分词文本，中文检索会受 unicode61 分词能力限制。
因此 ClawNote 在 FTS5 没有命中时，会使用参数化 LIKE 查询作为中文关键词兜底。
这个方案不是语义检索，但速度快、可解释，并且便于测试。
""",
    },
    {
        "title": "中文分词与关键词检索进阶",
        "category": "检索系统",
        "tags": ["中文分词", "关键词检索", "SQLite", "FTS5", "进阶"],
        "source": "Markdown 文件演示",
        "source_url": "docs/demo-sources/chinese-tokenization.md",
        "content_type": "file",
        "summary": "中文检索需要更细的分词策略，否则全文检索可能漏掉重要关键词。",
        "content": """
中文文本不像英文一样天然用空格分隔词语，因此全文检索需要分词器把句子拆成可索引的词。
SQLite FTS5 默认 unicode61 分词器对中文支持有限，可能把连续中文当成较大的 token。
ClawNote 当前通过 LIKE 兜底保证中文关键词可以命中，但这不是长期最优方案。
后续可以接入中文分词器，把“向量数据库”“知识检索”“强化学习”等词语稳定切出来。
更进一步，还可以结合 BM25 排序、标签加权和语义向量检索，提升召回质量。
""",
    },
    {
        "title": "混合检索设计：关键词与向量一起工作",
        "category": "检索系统",
        "tags": ["混合检索", "关键词检索", "向量检索", "RAG", "进阶"],
        "source": "网页导入演示",
        "source_url": "https://example.com/hybrid-search-demo",
        "content_type": "webpage",
        "summary": "混合检索结合关键词精确匹配和向量语义召回，适合提升 RAG 的证据质量。",
        "content": """
关键词检索擅长处理专有名词、编号、接口名和明确短语；向量检索擅长处理语义相近但字面不同的问题。
混合检索会同时运行两类检索，再把结果合并、去重和重排。
在 ClawNote 中，SQLite FTS5 可以承担关键词召回，未来的 Embedding 和向量数据库可以承担语义召回。
合并结果时可以考虑标题命中、标签重合、摘要相关性和创建时间等信号。
混合检索的目标不是让系统更复杂，而是让问答阶段拿到更可靠的证据。
""",
    },
    {
        "title": "重排序优化：让最有用的证据排在前面",
        "category": "AI 技术",
        "tags": ["重排序", "RAG", "检索优化", "引用来源", "进阶"],
        "source": "粘贴文本演示",
        "source_url": "",
        "content_type": "text",
        "summary": "重排序会在初步检索后重新评估证据质量，减少无关内容进入生成阶段。",
        "content": """
RAG 的召回阶段可能返回很多候选片段，但排在前面的不一定最适合回答当前问题。
重排序会根据问题和候选证据的匹配程度重新排序，常见做法包括规则打分、交叉编码器或大模型评估。
ClawNote 现在使用标题、标签、摘要和正文加权检索，已经具备基础重排序思想。
后续可以增加专门的 reranker，把引用来源更精准地排到前面。
这会直接改善问答质量，也能让答辩展示中的引用更可信。
""",
    },
    {
        "title": "RAG 幻觉控制与引用来源设计",
        "category": "AI 技术",
        "tags": ["RAG", "幻觉控制", "引用来源", "证据", "进阶"],
        "source": "Markdown 文件演示",
        "source_url": "docs/demo-sources/rag-citations.md",
        "content_type": "file",
        "summary": "通过证据约束、拒答策略和引用编号，RAG 可以降低大模型幻觉风险。",
        "content": """
大模型幻觉指模型生成看似合理但缺少真实依据的内容。
ClawNote 的问答流程先检索知识库，如果没有相关证据，就直接返回无法回答，而不是强行调用模型。
如果有证据，后端会把有限证据交给 qa Agent，并要求它只能基于证据回答。
引用编号、标题和来源 URL 由后端生成，避免相信模型随意编造的来源。
这种设计让用户可以从回答跳回具体知识详情，形成可核验的知识闭环。
""",
    },
    {
        "title": "FastAPI 接口实践：知识库 CRUD 与推荐 API",
        "category": "软件开发",
        "tags": ["FastAPI", "REST API", "CRUD", "推荐系统", "应用"],
        "source": "网页导入演示",
        "source_url": "https://example.com/fastapi-api-demo",
        "content_type": "webpage",
        "summary": "FastAPI 为 ClawNote 提供知识管理、问答、图谱和推荐等 REST 接口。",
        "content": """
ClawNote 后端使用 FastAPI 暴露 REST API，前端通过这些接口完成知识列表、详情、新增、修改和删除。
推荐接口以当前知识 id 为输入，返回相似知识、学习路径和知识缺口。
接口层负责参数校验、错误码、响应结构和跨域配置。
相比让前端直接操作数据库，FastAPI 可以把数据规则集中在后端，便于测试和维护。
在答辩中，接口文档页面和健康检查接口也可以作为工程完整性的证据。
""",
    },
    {
        "title": "React 前端状态管理与错误重试",
        "category": "软件开发",
        "tags": ["React", "加载状态", "错误重试", "前端交互", "应用"],
        "source": "粘贴文本演示",
        "source_url": "",
        "content_type": "text",
        "summary": "清晰的加载、错误、空数据和重试状态能显著提升知识管理系统的可用性。",
        "content": """
ClawNote 前端使用 React 管理工作台、知识库、问答、图谱和推荐页面。
每个异步请求都需要处理加载中、成功、失败和空数据状态。
导入网页或调用模型时可能出现网络超时，因此前端提供中文错误提示和重试入口。
在答辩场景下，稳定的异常状态可以避免现场网络波动导致页面看起来像坏掉。
推荐页通过学习路径、相关知识和知识缺口三个视图，让用户更清楚下一步可以做什么。
""",
    },
    {
        "title": "文件上传导入实践：Markdown 学习笔记入库",
        "category": "软件开发",
        "tags": ["文件上传", "Markdown", "知识采集", "FastAPI", "应用"],
        "source": "Markdown 文件演示",
        "source_url": "docs/demo-sources/file-import.md",
        "content_type": "file",
        "summary": "文件上传让用户可以把本地 Markdown 或 TXT 学习资料整理成结构化知识。",
        "content": """
很多个人知识已经存在于本地 Markdown、TXT 或课程笔记中，文件上传可以降低迁移成本。
ClawNote 的 collector 会读取上传文件，提取标题和正文，再交给 organizer 生成摘要、分类和标签。
后端限制文件大小和类型，避免过大的输入拖慢模型整理流程。
对于答辩演示，可以准备几份 Markdown 文件，通过上传入口展示多源知识采集能力。
文件来源会保存到知识详情中，方便用户知道这条知识来自哪里。
""",
    },
    {
        "title": "OpenClaw 多 Agent 调度应用",
        "category": "多 Agent",
        "tags": ["OpenClaw", "Agent", "steward", "任务调度", "应用"],
        "source": "粘贴文本演示",
        "source_url": "",
        "content_type": "text",
        "summary": "steward 作为总控 Agent 调度 collector、organizer、graph、qa 和 recommender 完成闭环。",
        "content": """
ClawNote 使用 OpenClaw 构建多 Agent 协作流程。
steward 接收用户需求并拆分任务，collector 负责采集内容，organizer 负责整理和入库。
graph 负责生成实体关系，qa 负责带引用的问答，recommender 负责相似知识和学习路径推荐。
多 Agent 架构的价值在于职责清晰、失败位置可定位，并且每个 Agent 可以拥有更窄的工具权限。
答辩中可以通过飞书机器人展示完整链路，也可以通过 Web 前端展示最终用户体验。
""",
    },
    {
        "title": "Agent 失败重试与权限隔离",
        "category": "多 Agent",
        "tags": ["Agent", "失败重试", "权限隔离", "OpenClaw", "进阶"],
        "source": "Markdown 文件演示",
        "source_url": "docs/demo-sources/agent-retry.md",
        "content_type": "file",
        "summary": "多 Agent 系统需要明确工具权限、真实调用结果和失败后的重试入口。",
        "content": """
多 Agent 系统容易出现一个问题：上游 Agent 声称下游已经完成，但实际上没有真实工具结果。
ClawNote 在 steward 指令中要求必须基于真实工具返回汇总，不能凭空声称调用成功。
权限隔离也很重要，organizer 可以写入数据库，但 qa 只应该基于检索证据回答。
当 OpenClaw、DeepSeek 或网络代理不稳定时，系统需要提示具体失败环节，并提供重试入口。
这些规则让多 Agent 协作更适合答辩和真实使用。
""",
    },
    {
        "title": "学习路径推荐：从相似内容到下一步学习",
        "category": "知识管理",
        "tags": ["学习路径", "推荐系统", "标签相似度", "知识缺口", "应用"],
        "source": "粘贴文本演示",
        "source_url": "",
        "content_type": "text",
        "summary": "学习路径推荐根据当前知识库组织基础、进阶、应用和拓展阶段。",
        "content": """
传统推荐通常只回答“你可能还想看哪些相似内容”。
ClawNote 的推荐页进一步回答“下一步应该学什么”。
系统会根据当前知识的分类、标签、标题和摘要，生成基础、进阶、应用、拓展四类学习路径。
同时，知识缺口会提示当前主题还可以补充哪些内容，例如 Embedding、向量数据库、重排序或中文分词。
这个功能让 ClawNote 更像个人智能知识管家，而不只是一个笔记列表。
""",
    },
    {
        "title": "项目答辩演示流程与回归测试",
        "category": "项目管理",
        "tags": ["答辩演示", "回归测试", "MoSCoW", "项目管理", "应用"],
        "source": "粘贴文本演示",
        "source_url": "",
        "content_type": "text",
        "summary": "答辩前需要准备稳定演示数据、截图证据、测试结果和固定讲解路径。",
        "content": """
项目答辩不只看功能数量，更看系统是否稳定、逻辑是否清楚、演示是否连贯。
ClawNote 可以按 MoSCoW 方法说明需求优先级：Must 包括采集、整理、存储、检索和问答；Should 包括图谱和推荐。
演示流程建议从工作台开始，然后导入知识、查看详情、问答引用、分类地图、关联探索和学习推荐。
回归测试需要覆盖 Python unittest、Jest、ESLint 和 Vite build。
准备高关联演示数据可以让图谱和推荐结果更像一个真实的知识系统。
""",
    },
]


DEMO_MARKDOWN = {
    "sqlite-fts5.md": "# SQLite FTS5 基础\n\nSQLite FTS5 为本地知识库提供全文检索能力，适合零服务部署。",
    "chinese-tokenization.md": "# 中文分词与关键词检索\n\n中文检索需要分词器和兜底策略共同保证召回。",
    "rag-citations.md": "# RAG 引用来源\n\n回答必须能跳回知识来源，才能降低幻觉风险。",
    "file-import.md": "# Markdown 文件导入\n\n文件上传可以把本地学习笔记迁移到 ClawNote。",
    "agent-retry.md": "# Agent 失败重试\n\n多 Agent 调度需要真实工具结果、权限隔离和重试入口。",
}


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 5000")
    return connection


def backup_database(connection: sqlite3.Connection) -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = BACKUP_DIR / f"clawnote-before-demo-{stamp}.db"
    connection.execute("PRAGMA wal_checkpoint(FULL)")
    with sqlite3.connect(backup_path) as backup:
        connection.backup(backup)
    return backup_path


def reset_database(connection: sqlite3.Connection) -> None:
    connection.executescript(INIT_SQL_PATH.read_text(encoding="utf-8"))
    connection.execute("DELETE FROM knowledge_items")
    connection.execute("DELETE FROM sqlite_sequence WHERE name = 'knowledge_items'")
    connection.execute("INSERT INTO knowledge_fts(knowledge_fts) VALUES ('rebuild')")


def seed_items(connection: sqlite3.Connection) -> list[int]:
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
    ids = []
    for item in DEMO_ITEMS:
        cursor = connection.execute(
            sql,
            (
                item["title"],
                " ".join(item["content"].split()),
                item["summary"],
                item["category"],
                json.dumps(item["tags"], ensure_ascii=False),
                item["source"],
                item["source_url"],
                item["content_type"],
            ),
        )
        ids.append(cursor.lastrowid)
    return ids


def write_demo_sources() -> None:
    DEMO_SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    for name, content in DEMO_MARKDOWN.items():
        (DEMO_SOURCE_DIR / name).write_text(content, encoding="utf-8")


def main() -> None:
    with closing(connect()) as connection, connection:
        backup_path = backup_database(connection)
        reset_database(connection)
        ids = seed_items(connection)
    write_demo_sources()
    print(json.dumps({
        "success": True,
        "backup": str(backup_path),
        "database": str(DB_PATH),
        "demo_sources": str(DEMO_SOURCE_DIR),
        "count": len(ids),
        "ids": ids,
        "categories": sorted({item["category"] for item in DEMO_ITEMS}),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
