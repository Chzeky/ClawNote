/** Typed request, citation, and response for knowledge-base QA. */
export interface KnowledgeQaInput {
  question: string;
  query?: string;
  limit?: number;
}

export interface KnowledgeSearchItem {
  id: number;
  title: string;
  summary: string;
  content: string;
  source: string;
  source_url?: string;
}

export interface SearchPayload {
  success: true;
  count: number;
  items: KnowledgeSearchItem[];
}

export interface KnowledgeCitation {
  knowledgeId: number;
  title: string;
  source: string;
}

export interface KnowledgeQaResult {
  answer: string;
  citations: KnowledgeCitation[];
  confidence: "none" | "medium" | "high";
}

export interface QaConfig {
  pythonCommand: string;
  scriptPath: string;
  defaultLimit: number;
  maxLimit: number;
  timeoutMs: number;
  maxOutputBytes: number;
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options: { timeoutMs: number; maxOutputBytes: number }
) => Promise<string>;

export interface QaDependencies {
  runCommand: CommandRunner;
}
