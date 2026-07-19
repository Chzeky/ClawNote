/** Deterministic entity and relation helpers. */
import type { GraphEntity, GraphRelation } from "./types";

export function extractKnownEntities(
  content: string,
  knownEntities: readonly string[],
  maxEntities: number
): GraphEntity[] {
  const normalized = content.toLocaleLowerCase();
  return knownEntities
    .filter((name) => normalized.includes(name.toLocaleLowerCase()))
    .slice(0, maxEntities)
    .map((name) => ({
      id: name.toLocaleLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-"),
      name,
      type: /^(OpenClaw|FastAPI|SQLite|DeepSeek)$/i.test(name)
        ? "technology"
        : "concept"
    }));
}

export function buildCoOccurrenceRelations(
  content: string,
  entities: readonly GraphEntity[],
  maxRelations: number
): GraphRelation[] {
  const sentences = content.split(/[。！？.!?]/).map((value) => value.trim()).filter(Boolean);
  const relations: GraphRelation[] = [];
  for (const sentence of sentences) {
    const matched = entities.filter((entity) =>
      sentence.toLocaleLowerCase().includes(entity.name.toLocaleLowerCase())
    );
    for (let left = 0; left < matched.length; left += 1) {
      for (let right = left + 1; right < matched.length; right += 1) {
        relations.push({
          source: matched[left].id,
          target: matched[right].id,
          type: "co_occurs_with",
          evidence: sentence
        });
        if (relations.length >= maxRelations) return relations;
      }
    }
  }
  return relations;
}
