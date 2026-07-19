import { buildKnowledgeGraph } from "../index";

describe("build-knowledge-graph", () => {
  test("extracts configured entities with evidence relations", () => {
    const graph = buildKnowledgeGraph({
      knowledgeId: 5,
      content: "RAG 使用 SQLite 检索知识。OpenClaw 使用 FastAPI 提供接口。"
    });
    expect(graph.entities.map((entity) => entity.name)).toEqual(
      expect.arrayContaining(["RAG", "SQLite", "OpenClaw", "FastAPI"])
    );
    expect(graph.relations).toHaveLength(2);
    expect(graph.relations[0].evidence).toContain("RAG");
  });

  test("does not invent relations across separate sentences", () => {
    const graph = buildKnowledgeGraph({
      knowledgeId: 1,
      content: "RAG 是一种方法。SQLite 是数据库。"
    });
    expect(graph.relations).toHaveLength(0);
  });

  test("rejects invalid knowledge identifiers", () => {
    expect(() => buildKnowledgeGraph({ knowledgeId: 0, content: "RAG" }))
      .toThrow("positive integer");
  });
});
