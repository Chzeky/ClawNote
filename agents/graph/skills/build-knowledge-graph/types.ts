/** Knowledge graph input and output types. */
export interface GraphInput {
  knowledgeId: number;
  content: string;
}

export interface GraphEntity {
  id: string;
  name: string;
  type: "technology" | "concept";
}

export interface GraphRelation {
  source: string;
  target: string;
  type: "co_occurs_with";
  evidence: string;
}

export interface KnowledgeGraph {
  knowledgeId: number;
  entities: GraphEntity[];
  relations: GraphRelation[];
}

export interface GraphConfig {
  knownEntities: string[];
  maxEntities: number;
  maxRelations: number;
}
