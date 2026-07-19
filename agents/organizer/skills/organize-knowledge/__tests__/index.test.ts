import { storeOrganizedKnowledge } from "../index";
import type { CommandRunner } from "../types";

describe("organize-knowledge", () => {
  test("stores a valid organized item", async () => {
    const runCommand: jest.MockedFunction<CommandRunner> = jest
      .fn()
      .mockResolvedValue('{"success":true,"stored":true,"knowledge_id":7}');
    const result = await storeOrganizedKnowledge({
      title: "RAG",
      content: "Retrieval augmented generation.",
      summary: "RAG adds retrieved context.",
      category: "AI",
      tags: ["RAG", "retrieval"]
    }, { runCommand });

    expect(result.knowledge_id).toBe(7);
    expect(runCommand.mock.calls[0][1]).toContain("--tag");
  });

  test("keeps injection text as one process argument", async () => {
    const runCommand: jest.MockedFunction<CommandRunner> = jest
      .fn()
      .mockResolvedValue('{"success":true,"stored":true,"knowledge_id":8}');
    const maliciousTitle = 'note"; rm -rf /';
    await storeOrganizedKnowledge({
      title: maliciousTitle,
      content: "safe content",
      summary: "safe",
      category: "test",
      tags: ["security"]
    }, { runCommand });

    expect(runCommand.mock.calls[0][1]).toContain(maliciousTitle);
    expect(runCommand.mock.calls[0][0]).toBe("python3");
  });

  test("rejects missing tags before storage", async () => {
    const runCommand = jest.fn<ReturnType<CommandRunner>, Parameters<CommandRunner>>();
    await expect(storeOrganizedKnowledge({
      title: "RAG",
      content: "content",
      summary: "summary",
      category: "AI",
      tags: []
    }, { runCommand })).rejects.toThrow("between 1 and 10");
    expect(runCommand).not.toHaveBeenCalled();
  });

  test("rejects whitespace-only tags", async () => {
    const runCommand = jest.fn<ReturnType<CommandRunner>, Parameters<CommandRunner>>();
    await expect(storeOrganizedKnowledge({
      title: "RAG",
      content: "content",
      summary: "summary",
      category: "AI",
      tags: ["   "]
    }, { runCommand })).rejects.toThrow("between 1 and 10");
    expect(runCommand).not.toHaveBeenCalled();
  });
});
