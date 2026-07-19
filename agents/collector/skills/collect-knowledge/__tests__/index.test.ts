import { collectKnowledge } from "../index";
import type { CommandRunner } from "../types";

describe("collect-knowledge", () => {
  const successPayload = JSON.stringify({
    status: "success",
    source_type: "text",
    source: "user_input",
    title: "RAG",
    content: "RAG uses retrieval.",
    collected_at: "2026-07-19T00:00:00Z"
  });

  test("collects text through the injected runner", async () => {
    const runCommand: jest.MockedFunction<CommandRunner> = jest
      .fn()
      .mockResolvedValue(successPayload);

    const result = await collectKnowledge(
      { kind: "text", title: "RAG", content: "RAG uses retrieval." },
      { runCommand }
    );

    expect(result.title).toBe("RAG");
    expect(runCommand.mock.calls[0][1]).toContain("--content");
  });

  test("rejects empty text", async () => {
    const runCommand = jest.fn<ReturnType<CommandRunner>, Parameters<CommandRunner>>();
    await expect(
      collectKnowledge({ kind: "text", content: "   " }, { runCommand })
    ).rejects.toThrow("cannot be empty");
    expect(runCommand).not.toHaveBeenCalled();
  });

  test("rejects loopback webpages before external access", async () => {
    const runCommand = jest.fn<ReturnType<CommandRunner>, Parameters<CommandRunner>>();
    await expect(
      collectKnowledge({ kind: "webpage", url: "http://127.0.0.1/admin" }, { runCommand })
    ).rejects.toThrow("public HTTP/HTTPS");
    expect(runCommand).not.toHaveBeenCalled();
  });
});
