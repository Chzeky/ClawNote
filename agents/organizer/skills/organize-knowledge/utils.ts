/** Utilities for safe database command execution and output validation. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { CommandRunner, StoreKnowledgeResult } from "./types";

const execFileAsync = promisify(execFile);

export const runCommand: CommandRunner = async (command, args, options) => {
  const { stdout } = await execFileAsync(command, [...args], {
    timeout: options.timeoutMs,
    maxBuffer: options.maxOutputBytes
  });
  return stdout;
};

export function parseStoreResult(output: string): StoreKnowledgeResult {
  const parsed: unknown = JSON.parse(output);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("success" in parsed) ||
    parsed.success !== true ||
    !("stored" in parsed) ||
    parsed.stored !== true ||
    !("knowledge_id" in parsed) ||
    typeof parsed.knowledge_id !== "number"
  ) {
    throw new Error("knowledge database returned an invalid store result");
  }
  return parsed as StoreKnowledgeResult;
}
