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
    return {
        "nodes": nodes,
        "links": links,
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
        },
        "items": recommendations[:limit],
        "count": min(len(recommendations), limit),
    }
