/** Store an Agent-organized knowledge item through the parameterized Python CLI. */
import skillConfig from "./config.json";
import type {
  OrganizedKnowledgeInput,
  OrganizerConfig,
  OrganizerDependencies,
  StoreKnowledgeResult
} from "./types";
import { parseStoreResult, runCommand } from "./utils";

const SKILL_NAME = "organize-knowledge";
const config = skillConfig as OrganizerConfig;

export async function storeOrganizedKnowledge(
  input: OrganizedKnowledgeInput,
  dependencies: OrganizerDependencies = { runCommand }
): Promise<StoreKnowledgeResult> {
  try {
    if (!input.title.trim() || !input.content.trim()) {
      throw new Error("title and content are required");
    }
    const normalizedTags = input.tags.map((tag) => tag.trim()).filter(Boolean);
    if (normalizedTags.length < 1 || normalizedTags.length > 10) {
      throw new Error("tags must contain between 1 and 10 values");
    }

    const args = [
      config.scriptPath,
      "add",
      "--title", input.title.trim(),
      "--content", input.content.trim(),
      "--summary", input.summary.trim(),
      "--category", input.category.trim() || "未分类",
      "--source", input.source?.trim() || config.defaultSource
    ];
    for (const tag of normalizedTags) {
      args.push("--tag", tag);
    }

    console.log(`[${SKILL_NAME}] store: ${input.title.trim()}`);
    const output = await dependencies.runCommand(config.pythonCommand, args, {
      timeoutMs: config.timeoutMs,
      maxOutputBytes: config.maxOutputBytes
    });
    return parseStoreResult(output);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${SKILL_NAME}] failed: ${message}`);
    throw new Error(`[${SKILL_NAME}] store failed: ${message}`);
  }
}

export type { OrganizedKnowledgeInput, StoreKnowledgeResult } from "./types";
