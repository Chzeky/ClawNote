import { answerFromKnowledge } from "../index";
import type { CommandRunner } from "../types";

describe("knowledge-qa", () => {
  test("returns evidence with knowledge citations", async () => {
    const runCommand: jest.MockedFunction<CommandRunner> = jest.fn().mockResolvedValue(
      JSON.stringify({
        success: true,
        count: 1,
        items: [{
          id: 2,
          title: "RAG基础概念",
          summary: "RAG 使用检索内容增强回答。",
          content: "content",
          source: "user_input",
          source_url: ""
        }]
      })
    );
    const result = await answerFromKnowledge(
      { question: "RAG是什么？", query: "RAG" },
      { runCommand }
    );
    expect(result.answer).toContain("[知识 #2：RAG基础概念]");
    expect(result.citations[0].knowledgeId).toBe(2);
  });

  test("states that no evidence was found", async () => {
    const runCommand: jest.MockedFunction<CommandRunner> = jest
      .fn()
      .mockResolvedValue('{"success":true,"count":0,"items":[]}');
    const result = await answerFromKnowledge({ question: "不存在的问题" }, { runCommand });
    expect(result.confidence).toBe("none");
    expect(result.citations).toEqual([]);
  });

  test("passes hostile query text as one process argument", async () => {
    const runCommand: jest.MockedFunction<CommandRunner> = jest
      .fn()
      .mockResolvedValue('{"success":true,"count":0,"items":[]}');
    const query = 'RAG"; cat ~/.ssh/id_rsa';
    await answerFromKnowledge({ question: query, query }, { runCommand });
    expect(runCommand.mock.calls[0][1]).toContain(query);
    expect(runCommand.mock.calls[0][0]).toBe("python3");
  });
});
