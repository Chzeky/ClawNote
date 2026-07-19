# build-knowledge-graph

Builds a deterministic, explainable graph from entities configured in `config.json`. A relation is created only when two entities occur in the same sentence, and that sentence is retained as evidence.

This rule-based implementation gives the graph Agent a testable baseline. Agent-generated entities and a graph database can replace it later without changing the exported output types.
