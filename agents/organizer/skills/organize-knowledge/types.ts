/** Strongly typed input and output for organized knowledge storage. */
export interface OrganizedKnowledgeInput {
  title: string;
  content: string;
  summary: string;
  category: string;
  tags: string[];
  source?: string;
}

export interface StoreKnowledgeResult {
  success: true;
  stored: true;
  knowledge_id: number;
}

export interface OrganizerConfig {
  pythonCommand: string;
  scriptPath: string;
  timeoutMs: number;
  maxOutputBytes: number;
  defaultSource: string;
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options: { timeoutMs: number; maxOutputBytes: number }
) => Promise<string>;

export interface OrganizerDependencies {
  runCommand: CommandRunner;
}
