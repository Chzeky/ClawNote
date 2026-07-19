"""Deterministic overview, graph, and recommendation helpers."""

import json
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
GRAPH_CONFIG_PATH = (
    PROJECT_ROOT
    / "agents"
    / "graph"
    / "skills"
    / "build-knowledge-graph"
    / "config.json"
)
CATEGORY_ALIASES = {
    "ai": "AI 技术",
    "ai技术": "AI 技术",
    "人工智能": "AI 技术",
    "web开发": "软件开发",
    "前端开发": "软件开发",
    "后端开发": "软件开发",
}
LEARNING_STAGE_RULES = [
    ("基础", ["入门", "基础", "概念", "原理", "介绍", "是什么", "overview"]),
    ("进阶", ["优化", "架构", "调度", "检索", "设计", "实现", "机制"]),
    ("应用", ["项目", "实践", "案例", "系统", "部署", "接口", "web", "fastapi", "react"]),
    ("拓展", ["展望", "向量", "embedding", "性能", "缓存", "安全", "权限", "混合"]),
]
STAGE_ORDER = {name: index for index, (name, _) in enumerate(LEARNING_STAGE_RULES)}
GAP_SUGGESTIONS = {
    "rag": ["Embedding", "向量数据库", "重排序", "混合检索", "评估指标", "上下文压缩"],
    "知识检索": ["Embedding", "向量数据库", "中文分词"],
    "向量检索": ["重排序", "混合检索", "评估指标"],
    "sqlite": ["索引优化", "事务", "备份恢复"],
    "fts5": ["中文分词", "BM25 排序", "混合检索"],
    "fastapi": ["认证授权", "异常处理中间件", "接口文档"],
    "react": ["状态管理", "错误边界", "可访问性"],
    "agent": ["任务编排", "失败重试", "权限隔离"],
    "应用": ["验收标准", "用户反馈", "演示脚本"],
    "进阶": ["评估指标", "性能基线", "风险预案"],
    "ai 技术": ["Prompt 注入防护", "上下文压缩", "离线评估"],
    "检索系统": ["召回率评估", "索引维护", "查询改写"],
    "项目管理": ["风险预案", "答辩问答", "演示脚本"],
}


def parse_tags(value: str | list[str] | None) -> list[str]:
    if isinstance(value, list):
        raw_tags = value
    else:
        try:
            raw_tags = json.loads(value or "[]")
        except (json.JSONDecodeError, TypeError):
            return []
    if not isinstance(raw_tags, list):
        return []
    seen = set()
    tags = []
    for value in raw_tags:
        if not isinstance(value, str):
            continue
        tag = value.strip()
        key = tag.casefold()
        if tag and key not in seen:
            seen.add(key)
            tags.append(tag)
    return tags


def normalize_item(row) -> dict:
    item = dict(row)
    item["tags"] = parse_tags(item.get("tags"))
    return item


def normalize_category(value: str | None) -> str:
    category = " ".join((value or "未分类").strip().split()) or "未分类"
    alias_key = category.casefold().replace(" ", "")
    return CATEGORY_ALIASES.get(alias_key, category)


def build_overview(items: list[dict]) -> dict:
    categories = Counter(item.get("category") or "未分类" for item in items)
    sources = Counter(item.get("source") or "未记录" for item in items)
    tags = Counter(tag for item in items for tag in item["tags"])
    return {
        "total": len(items),
        "category_count": len(categories),
        "tag_count": len(tags),
        "source_count": len(sources),
        "categories": [
            {"name": name, "count": count}
            for name, count in categories.most_common(8)
        ],
        "sources": [
            {"name": name, "count": count}
            for name, count in sources.most_common(8)
        ],
        "top_tags": [
            {"name": name, "count": count}
            for name, count in tags.most_common(12)
        ],
        "recent": [
            {
                "id": item["id"],
                "title": item["title"],
                "category": item.get("category") or "未分类",
                "created_at": item.get("created_at") or "",
            }
            for item in items[:5]
        ],
    }


def load_known_entities() -> list[str]:
    try:
        payload = json.loads(GRAPH_CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    values = payload.get("knownEntities", [])
    return [value for value in values if isinstance(value, str) and value.strip()]


def item_concepts(item: dict, known_entities: list[str]) -> list[str]:
    searchable = " ".join([
        item.get("title") or "",
        item.get("summary") or "",
        item.get("content") or "",
    ]).casefold()
    values = [*item["tags"]]
    values.extend(
        entity
        for entity in known_entities
        if entity.casefold() in searchable
    )
    seen = set()
    concepts = []
    for value in values:
        key = value.casefold()
        if key not in seen:
            seen.add(key)
            concepts.append(value)
    return concepts[:12]


def concept_id(name: str) -> str:
    return f"concept:{name.casefold()}"


def build_graph(items: list[dict]) -> dict:
    known_entities = load_known_entities()
    concept_frequency = Counter()
    knowledge_concepts = {}
    for item in items:
        concepts = item_concepts(item, known_entities)
        knowledge_concepts[item["id"]] = concepts
        concept_frequency.update(concepts)

    nodes = [
        {
            "id": f"knowledge:{item['id']}",
            "label": item["title"],
            "type": "knowledge",
            "knowledge_id": item["id"],
            "category": normalize_category(item.get("category")),
            "weight": max(1, len(knowledge_concepts[item["id"]])),
        }
        for item in items
    ]
    nodes.extend(
        {
            "id": concept_id(name),
            "label": name,
            "type": "concept",
            "knowledge_id": None,
            "weight": count,
        }
        for name, count in concept_frequency.most_common(24)
    )
    allowed_concepts = {
        node["id"] for node in nodes if node["type"] == "concept"
    }

    links = []
    co_occurrences = defaultdict(lambda: {"weight": 0, "evidence": ""})
    for item in items:
        concepts = [
            name for name in knowledge_concepts[item["id"]]
            if concept_id(name) in allowed_concepts
        ]
        for name in concepts:
            links.append({
                "source": f"knowledge:{item['id']}",
                "target": concept_id(name),
                "type": "has_concept",
                "weight": 1,
                "evidence": item["title"],
            })
        for left, right in combinations(sorted(concepts, key=str.casefold), 2):
            pair = (concept_id(left), concept_id(right))
            co_occurrences[pair]["weight"] += 1
            if not co_occurrences[pair]["evidence"]:
                co_occurrences[pair]["evidence"] = item["title"]

    strongest_relations = sorted(
        co_occurrences.items(),
        key=lambda entry: (-entry[1]["weight"], entry[0]),
    )[:30]
    links.extend(
        {
            "source": pair[0],
            "target": pair[1],
            "type": "co_occurs_with",
            "weight": data["weight"],
            "evidence": data["evidence"],
        }
        for pair, data in strongest_relations
    )
    category_items = defaultdict(list)
    for item in items:
        category_items[normalize_category(item.get("category"))].append(item["id"])
    categories = [
        {
            "id": f"category:{name.casefold()}",
            "label": name,
            "knowledge_count": len(knowledge_ids),
            "knowledge_ids": knowledge_ids,
        }
        for name, knowledge_ids in sorted(
            category_items.items(),
            key=lambda entry: (-len(entry[1]), entry[0]),
        )
    ]
    return {
        "nodes": nodes,
        "links": links,
        "categories": categories,
        "knowledge_count": len(items),
        "concept_count": len(allowed_concepts),
        "relation_count": len(links),
    }


def jaccard_similarity(left: list[str], right: list[str]) -> tuple[float, list[str]]:
    left_map = {value.casefold(): value for value in left}
    right_map = {value.casefold(): value for value in right}
    union = set(left_map) | set(right_map)
    matched_keys = set(left_map) & set(right_map)
    if not union:
        return 0.0, []
    matched = [left_map[key] for key in sorted(matched_keys)]
    return len(matched_keys) / len(union), matched


def recommend_items(items: list[dict], knowledge_id: int, limit: int) -> dict | None:
    source = next((item for item in items if item["id"] == knowledge_id), None)
    if source is None:
        return None

    recommendations = []
    for item in items:
        if item["id"] == knowledge_id:
            continue
        similarity, matched_tags = jaccard_similarity(source["tags"], item["tags"])
        if similarity <= 0:
            continue
        recommendations.append({
            "id": item["id"],
            "title": item["title"],
            "category": item.get("category") or "未分类",
            "tags": item["tags"],
            "matched_tags": matched_tags,
            "similarity": round(similarity, 4),
            "reason": f"共同标签：{'、'.join(matched_tags)}",
        })

    recommendations.sort(key=lambda item: (-item["similarity"], -item["id"]))
    return {
        "source": {
            "id": source["id"],
            "title": source["title"],
            "tags": source["tags"],
            "category": source.get("category") or "未分类",
        },
        "items": recommendations[:limit],
        "count": min(len(recommendations), limit),
        "learning_path": build_learning_path(items, source, max(3, min(limit, 6))),
        "gaps": suggest_knowledge_gaps(items, source),
    }


def stage_for_item(item: dict) -> str:
    searchable = " ".join([
        item.get("title") or "",
        item.get("summary") or "",
        " ".join(item["tags"]),
    ]).casefold()
    for stage, keywords in LEARNING_STAGE_RULES:
        if any(keyword.casefold() in searchable for keyword in keywords):
            return stage
    return "进阶"


def learning_score(source: dict, item: dict) -> tuple[int, float, list[str]]:
    matched_tags = jaccard_similarity(source["tags"], item["tags"])[1]
    same_category = normalize_category(source.get("category")) == normalize_category(item.get("category"))
    title_hit = any(tag.casefold() in (item.get("title") or "").casefold() for tag in source["tags"])
    score = len(matched_tags) * 3 + int(same_category) * 2 + int(title_hit)
    return score, len(matched_tags) / max(1, len(source["tags"])), matched_tags


def build_learning_path(items: list[dict], source: dict, limit: int) -> list[dict]:
    candidates = []
    for item in items:
        score, tag_overlap, matched_tags = learning_score(source, item)
        if item["id"] == source["id"]:
            score += 4
        if score <= 0:
            continue
        stage = stage_for_item(item)
        candidates.append({
            "id": item["id"],
            "title": item["title"],
            "category": item.get("category") or "未分类",
            "tags": item["tags"],
            "stage": stage,
            "matched_tags": matched_tags,
            "score": score,
            "reason": learning_reason(item, source, stage, matched_tags),
            "stage_order": STAGE_ORDER.get(stage, 1),
            "tag_overlap": tag_overlap,
        })

    candidates.sort(key=lambda item: (
        item["stage_order"],
        -item["score"],
        0 if item["id"] == source["id"] else 1,
        -item["id"],
    ))
    seen_ids = set()
    path = []
    for item in candidates:
        if item["id"] in seen_ids:
            continue
        seen_ids.add(item["id"])
        path.append({
            "id": item["id"],
            "title": item["title"],
            "category": item["category"],
            "tags": item["tags"],
            "stage": item["stage"],
            "matched_tags": item["matched_tags"],
            "reason": item["reason"],
        })
        if len(path) >= limit:
            break
    return path


def learning_reason(item: dict, source: dict, stage: str, matched_tags: list[str]) -> str:
    if item["id"] == source["id"]:
        return f"当前知识适合作为“{stage}”阶段的锚点。"
    if matched_tags:
        return f"与当前知识共享 {'、'.join(matched_tags)}，适合放在“{stage}”阶段继续学习。"
    return f"同属 {normalize_category(item.get('category'))}，可作为“{stage}”阶段的补充材料。"


def suggest_knowledge_gaps(items: list[dict], source: dict) -> list[dict]:
    existing = {tag.casefold() for item in items for tag in item["tags"]}
    source_keys = list(dict.fromkeys(tag.casefold() for tag in source["tags"]))
    category_key = normalize_category(source.get("category")).casefold()
    if category_key not in source_keys:
        source_keys.append(category_key)
    suggestions = []
    seen = set()
    for key in source_keys:
        for topic in GAP_SUGGESTIONS.get(key, []):
            topic_key = topic.casefold()
            if topic_key in existing or topic_key in seen:
                continue
            seen.add(topic_key)
            suggestions.append({
                "topic": topic,
                "reason": f"当前知识包含“{key}”，补充“{topic}”可以让学习路径更完整。",
            })
    return suggestions[:6]
