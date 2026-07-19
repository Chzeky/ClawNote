/** Build a deterministic graph from configured entities and sentence evidence. */
import skillConfig from "./config.json";
import type { GraphConfig, GraphInput, KnowledgeGraph } from "./types";
import { buildCoOccurrenceRelations, extractKnownEntities } from "./utils";

const SKILL_NAME = "build-knowledge-graph";
const config = skillConfig as GraphConfig;

export function buildKnowledgeGraph(input: GraphInput): KnowledgeGraph {
  try {
    if (!Number.isInteger(input.knowledgeId) || input.knowledgeId < 1) {
      throw new Error("knowledgeId must be a positive integer");
    }
    if (!input.content.trim()) throw new Error("content cannot be empty");

    const entities = extractKnownEntities(
      input.content,
      config.knownEntities,
      config.maxEntities
    );
    const relations = buildCoOccurrenceRelations(
      input.content,
      entities,
      config.maxRelations
    );
    console.log(`[${SKILL_NAME}] build: ${entities.length} entities`);
    return { knowledgeId: input.knowledgeId, entities, relations };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${SKILL_NAME}] failed: ${message}`);
    throw new Error(`[${SKILL_NAME}] graph failed: ${message}`);
  }
}

export type { GraphEntity, GraphInput, GraphRelation, KnowledgeGraph } from "./types";
