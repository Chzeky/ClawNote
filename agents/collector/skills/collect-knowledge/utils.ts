/** Utilities for safe command execution and collector output validation. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { CollectedKnowledge, CommandRunner } from "./types";

const execFileAsync = promisify(execFile);

export const runCommand: CommandRunner = async (command, args, options) => {
  const { stdout } = await execFileAsync(command, [...args], {
    timeout: options.timeoutMs,
    maxBuffer: options.maxOutputBytes
  });
  return stdout;
};

export function assertSafeWebUrl(value: string): void {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const privateHost =
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);

  if (!["http:", "https:"].includes(url.protocol) || privateHost) {
    throw new Error("webpage URL must be public HTTP/HTTPS");
  }
}

export function parseCollectedKnowledge(output: string): CollectedKnowledge {
  const parsed: unknown = JSON.parse(output);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("status" in parsed) ||
    parsed.status !== "success" ||
    !("content" in parsed) ||
    typeof parsed.content !== "string"
  ) {
    throw new Error("collector returned an invalid or failed payload");
  }
  return parsed as CollectedKnowledge;
}
