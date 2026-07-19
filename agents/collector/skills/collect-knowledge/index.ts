/** Collect text, Markdown/TXT files, or public webpages into one structure. */
import skillConfig from "./config.json";
import type {
  CollectedKnowledge,
  CollectionInput,
  CollectorConfig,
  CollectorDependencies
} from "./types";
import {
  assertSafeWebUrl,
  parseCollectedKnowledge,
  runCommand
} from "./utils";

const SKILL_NAME = "collect-knowledge";
const config = skillConfig as CollectorConfig;

export async function collectKnowledge(
  input: CollectionInput,
  dependencies: CollectorDependencies = { runCommand }
): Promise<CollectedKnowledge> {
  try {
    const args = [config.scriptPath, input.kind === "webpage" ? "url" : input.kind];

    if (input.kind === "text") {
      if (!input.content.trim()) throw new Error("text content cannot be empty");
      args.push("--content", input.content);
    } else if (input.kind === "file") {
      if (!input.path.trim()) throw new Error("file path cannot be empty");
      args.push("--path", input.path);
    } else {
      assertSafeWebUrl(input.url);
      args.push("--url", input.url);
    }

    if (input.title?.trim()) args.push("--title", input.title.trim());

    console.log(`[${SKILL_NAME}] collect: ${input.kind}`);
    const output = await dependencies.runCommand(config.pythonCommand, args, {
      timeoutMs: config.timeoutMs,
      maxOutputBytes: config.maxOutputBytes
    });
    return parseCollectedKnowledge(output);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${SKILL_NAME}] failed: ${message}`);
    throw new Error(`[${SKILL_NAME}] collection failed: ${message}`);
  }
}

export type { CollectedKnowledge, CollectionInput } from "./types";
