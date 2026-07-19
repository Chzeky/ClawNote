/** Recommendation input, candidate, and output types. */
export interface RecommendationInput {
  tags: string[];
  excludeKnowledgeIds?: number[];
  limit?: number;
}

export interface KnowledgeCandidate {
  id: number;
  title: string;
  category: string;
  tags: string | string[];
  source: string;
}

export interface ListPayload {
  success: true;
  items: KnowledgeCandidate[];
}

export interface KnowledgeRecommendation {
  knowledgeId: number;
  title: string;
  matchedTags: string[];
  similarity: number;
  reason: string;
}

export interface RecommenderConfig {
  pythonCommand: string;
  scriptPath: string;
  candidateLimit: number;
  defaultLimit: number;
  maxLimit: number;
  minimumSimilarity: number;
  timeoutMs: number;
  maxOutputBytes: number;
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options: { timeoutMs: number; maxOutputBytes: number }
) => Promise<string>;

export interface RecommenderDependencies {
  runCommand: CommandRunner;
}
