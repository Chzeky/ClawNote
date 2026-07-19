/** Utilities for parameterized search execution and citation generation. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type {
  CommandRunner,
  KnowledgeCitation,
  KnowledgeSearchItem,
  SearchPayload
} from "./types";

const execFileAsync = promisify(execFile);

export const runCommand: CommandRunner = async (command, args, options) => {
  const { stdout } = await execFileAsync(command, [...args], {
    timeout: options.timeoutMs,
    maxBuffer: options.maxOutputBytes
  });
  return stdout;
};

export function parseSearchPayload(output: string): SearchPayload {
  const parsed: unknown = JSON.parse(output);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("success" in parsed) ||
    parsed.success !== true ||
    !("items" in parsed) ||
    !Array.isArray(parsed.items)
  ) {
    throw new Error("knowledge search returned an invalid payload");
  }
  return parsed as SearchPayload;
}

export function toCitation(item: KnowledgeSearchItem): KnowledgeCitation {
  return {
    knowledgeId: item.id,
    title: item.title,
    source: item.source_url || item.source
  };
}
