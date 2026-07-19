import { recommendKnowledge } from "../index";
import type { CommandRunner } from "../types";
import { jaccardSimilarity } from "../utils";

describe("recommend-knowledge", () => {
  const candidates = JSON.stringify({
    success: true,
    items: [
      { id: 2, title: "RAG", category: "AI", tags: '["RAG","检索"]', source: "user" },
      { id: 3, title: "SQLite", category: "DB", tags: '["SQLite","数据库"]', source: "user" },
      { id: 4, title: "混合检索", category: "AI", tags: ["RAG", "检索", "向量检索"], source: "user" }
    ]
  });

  test("ranks candidates by tag similarity", async () => {
    const runCommand: jest.MockedFunction<CommandRunner> = jest.fn().mockResolvedValue(candidates);
    const results = await recommendKnowledge({ tags: ["RAG", "检索", "向量检索"] }, { runCommand });
    expect(results.map((item) => item.knowledgeId)).toEqual([4, 2]);
    expect(results[0].reason).toContain("共同标签");
  });

  test("excludes selected knowledge IDs", async () => {
    const runCommand: jest.MockedFunction<CommandRunner> = jest.fn().mockResolvedValue(candidates);
    const results = await recommendKnowledge({
      tags: ["RAG"],
      excludeKnowledgeIds: [4]
    }, { runCommand });
    expect(results.map((item) => item.knowledgeId)).toEqual([2]);
  });

  test("handles empty tag sets without division errors", () => {
    expect(jaccardSimilarity([], [])).toBe(0);
  });

  test("skips candidates with malformed legacy tag JSON", async () => {
    const runCommand: jest.MockedFunction<CommandRunner> = jest.fn().mockResolvedValue(
      JSON.stringify({
        success: true,
        items: [{ id: 9, title: "broken", category: "test", tags: "not-json", source: "legacy" }]
      })
    );
    await expect(recommendKnowledge({ tags: ["RAG"] }, { runCommand }))
      .resolves.toEqual([]);
  });

  test("scores 10000 comparisons within a practical unit-test budget", () => {
    const startedAt = Date.now();
    for (let index = 0; index < 10000; index += 1) {
      jaccardSimilarity(["rag", "search"], ["rag", "sqlite"]);
    }
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });
});
