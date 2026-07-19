/** Supported input for the knowledge collection Skill. */
export type CollectionInput =
  | { kind: "text"; content: string; title?: string }
  | { kind: "file"; path: string; title?: string }
  | { kind: "webpage"; url: string; title?: string };

export interface CollectedKnowledge {
  status: "success";
  source_type: "text" | "file" | "webpage";
  source: string;
  title: string;
  content: string;
  collected_at: string;
}

export interface CollectorConfig {
  pythonCommand: string;
  scriptPath: string;
  timeoutMs: number;
  maxOutputBytes: number;
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options: { timeoutMs: number; maxOutputBytes: number }
) => Promise<string>;

export interface CollectorDependencies {
  runCommand: CommandRunner;
}
