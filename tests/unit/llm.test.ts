import { afterEach, describe, expect, it, vi } from "vitest";
import { generate } from "../../src/server/llm";

afterEach(() => vi.unstubAllGlobals());

describe("requisição de geração", () => {
  it("solicita JSON no input mesmo quando o trabalho e as respostas não mencionam esse formato", async () => {
    const result = { action: "ASK", question: "Como você justifica essa escolha?" };
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      const request = JSON.parse(String(options.body));
      expect(request.input).toMatch(/json/i);
      expect(request.input).toContain("Análise de uma obra literária.");
      expect(request.input).toContain("Qual passagem sustenta sua interpretação?");
      expect(request.text.format.type).toBe("json_schema");
      expect(request.text.format.strict).toBe(true);
      expect(request.text.format.schema.properties.evidence.type).toBe("array");
      expect(request.text.format.schema.required).toContain("evidence");
      expect(request.store).toBe(false);
      return Response.json({
        output: [{ content: [{ type: "output_text", text: JSON.stringify(result) }] }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      generate(
        {
          title: "Interpretação",
          instructions: "Explique as decisões do trabalho.",
          discipline: "Letras",
          courses: ["Graduação"],
          maxQuestions: 5,
          objectives: [
            {
              id: "obj",
              description: "Justificar a interpretação",
              criterion: "Usa passagens da obra.",
            },
          ],
          work: "Análise de uma obra literária.",
        },
        [
          {
            id: "q1",
            text: "Qual passagem sustenta sua interpretação?",
            objectiveId: "obj",
            answer: { id: "a1", text: "A passagem final." },
          },
        ],
      ),
    ).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
