/** Integration test: TypeScript Skill invokes the real Python collector. */
import { collectKnowledge } from "../agents/collector/skills/collect-knowledge";

describe("collector integration", () => {
  test("collects text through the real Python process", async () => {
    const result = await collectKnowledge({
      kind: "text",
      title: "Integration test",
      content: "ClawNote TypeScript Skill calls the Python collector."
    });

    expect(result.status).toBe("success");
    expect(result.title).toBe("Integration test");
    expect(result.content).toContain("Python collector");
  });
});
