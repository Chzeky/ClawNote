/** Utilities for candidate loading and Jaccard tag similarity. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { CommandRunner, ListPayload } from "./types";

const execFileAsync = promisify(execFile);

export const runCommand: CommandRunner = async (command, args, options) => {
  const { stdout } = await execFileAsync(command, [...args], {
    timeout: options.timeoutMs,
    maxBuffer: options.maxOutputBytes
  });
  return stdout;
};

export function parseListPayload(output: string): ListPayload {
  const parsed: unknown = JSON.parse(output);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("success" in parsed) ||
    parsed.success !== true ||
    !("items" in parsed) ||
    !Array.isArray(parsed.items)
  ) {
    throw new Error("knowledge list returned an invalid payload");
  }
  return parsed as ListPayload;
}

export function normalizeTags(tags: string | string[]): string[] {
  let values: unknown = tags;
  if (typeof tags === "string") {
    try {
      values = JSON.parse(tags || "[]");
    } catch {
      return [];
    }
  }
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLocaleLowerCase())
    .filter(Boolean))];
}

export function jaccardSimilarity(left: readonly string[], right: readonly string[]): number {
  const leftSet = new Set(left.map((value) => value.toLocaleLowerCase()));
  const rightSet = new Set(right.map((value) => value.toLocaleLowerCase()));
  const union = new Set([...leftSet, ...rightSet]);
  if (union.size === 0) return 0;
  const intersection = [...leftSet].filter((value) => rightSet.has(value));
  return intersection.length / union.size;
}
