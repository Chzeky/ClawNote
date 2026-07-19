/** Recommend existing knowledge by deterministic Jaccard tag similarity. */
import skillConfig from "./config.json";
import type {
  KnowledgeRecommendation,
  RecommendationInput,
  RecommenderConfig,
  RecommenderDependencies
} from "./types";
import {
  jaccardSimilarity,
  normalizeTags,
  parseListPayload,
  runCommand
} from "./utils";

const SKILL_NAME = "recommend-knowledge";
const config = skillConfig as RecommenderConfig;

export async function recommendKnowledge(
  input: RecommendationInput,
  dependencies: RecommenderDependencies = { runCommand }
): Promise<KnowledgeRecommendation[]> {
  try {
    const inputTags = normalizeTags(input.tags);
    if (inputTags.length === 0) throw new Error("at least one tag is required");
    const excluded = new Set(input.excludeKnowledgeIds ?? []);
    const limit = Math.min(Math.max(input.limit ?? config.defaultLimit, 1), config.maxLimit);

    console.log(`[${SKILL_NAME}] recommend: ${inputTags.join(",")}`);
    const output = await dependencies.runCommand(config.pythonCommand, [
      config.scriptPath,
      "list",
      "--limit", String(config.candidateLimit)
    ], {
      timeoutMs: config.timeoutMs,
      maxOutputBytes: config.maxOutputBytes
    });
    const payload = parseListPayload(output);

    return payload.items
      .filter((item) => !excluded.has(item.id))
      .map((item) => {
        const candidateTags = normalizeTags(item.tags);
        const matchedTags = inputTags.filter((tag) => candidateTags.includes(tag));
        return {
          knowledgeId: item.id,
          title: item.title,
          matchedTags,
          similarity: jaccardSimilarity(inputTags, candidateTags),
          reason: matchedTags.length > 0
            ? `共同标签：${matchedTags.join("、")}`
            : "无共同标签"
        };
      })
      .filter((item) => item.similarity >= config.minimumSimilarity)
      .sort((left, right) => right.similarity - left.similarity || left.knowledgeId - right.knowledgeId)
      .slice(0, limit);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${SKILL_NAME}] failed: ${message}`);
    throw new Error(`[${SKILL_NAME}] recommendation failed: ${message}`);
  }
}

export type { KnowledgeRecommendation, RecommendationInput } from "./types";
