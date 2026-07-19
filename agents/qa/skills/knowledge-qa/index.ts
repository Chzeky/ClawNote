/** Retrieve personal knowledge and return an evidence-only QA context. */
import skillConfig from "./config.json";
import type {
  KnowledgeQaInput,
  KnowledgeQaResult,
  QaConfig,
  QaDependencies
} from "./types";
import { parseSearchPayload, runCommand, toCitation } from "./utils";

const SKILL_NAME = "knowledge-qa";
const config = skillConfig as QaConfig;

export async function answerFromKnowledge(
  input: KnowledgeQaInput,
  dependencies: QaDependencies = { runCommand }
): Promise<KnowledgeQaResult> {
  try {
    const question = input.question.trim();
    const query = input.query?.trim() || question;
    if (!question || !query) throw new Error("question and query cannot be empty");

    const limit = Math.min(Math.max(input.limit ?? config.defaultLimit, 1), config.maxLimit);
    const args = [
      config.scriptPath,
      "search",
      "--query", query,
      "--limit", String(limit)
    ];
    console.log(`[${SKILL_NAME}] search: ${query}`);
    const output = await dependencies.runCommand(config.pythonCommand, args, {
      timeoutMs: config.timeoutMs,
      maxOutputBytes: config.maxOutputBytes
    });
    const payload = parseSearchPayload(output);

    if (payload.items.length === 0) {
      return {
        answer: "个人知识库中没有找到可以支持该问题的内容。",
        citations: [],
        confidence: "none"
      };
    }

    const evidence = payload.items
      .map((item) => `[知识 #${item.id}：${item.title}] ${item.summary || item.content}`)
      .join("\n");
    return {
      answer: evidence,
      citations: payload.items.map(toCitation),
      confidence: payload.items.length > 1 ? "high" : "medium"
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${SKILL_NAME}] failed: ${message}`);
    throw new Error(`[${SKILL_NAME}] answer failed: ${message}`);
  }
}

export type { KnowledgeCitation, KnowledgeQaInput, KnowledgeQaResult } from "./types";
