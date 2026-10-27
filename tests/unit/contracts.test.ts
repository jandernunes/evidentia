import { describe, expect, it } from "vitest";
import {
  activityInput,
  csvSafe,
  newUserInput,
  userUpdateInput,
  validateGeneration,
} from "../../src/server/schemas";

describe("tamanho da senha", () => {
  const account = { name: "Conta de teste", email: "password@example.test", role: "ADMIN" };
  const version = { updatedAt: "2026-10-27T12:00:00.000Z" };
  it.each([7, 8, 12, 128, 129])("valida %i caracteres no cadastro e na redefinição", (length) => {
    const password = "x".repeat(length);
    const accepted = length >= 8 && length <= 128;
    expect(newUserInput.safeParse({ ...account, password }).success).toBe(accepted);
    expect(userUpdateInput.safeParse({ ...version, password }).success).toBe(accepted);
  });
  it("permite editar a conta sem alterar sua senha", () => {
    expect(userUpdateInput.safeParse({ ...version, name: "Nome atualizado" }).success).toBe(true);
  });
});

const valid = {
  action: "ASK",
  objectiveId: "objective-1",
  question: "Como você chegou a essa interpretação?",
  reason: "A resposta precisa justificar a interpretação.",
  evidence: [
    {
      objectiveId: "objective-1",
      state: "EVIDENCIA_PARCIAL",
      reason: "Há uma explicação inicial.",
      answerIds: ["answer-1"],
    },
  ],
};
describe("contrato de evidências", () => {
  it("aceita referências existentes", () =>
    expect(validateGeneration(valid, ["objective-1"], ["answer-1"])).toEqual(valid));
  it("rejeita resposta inventada", () =>
    expect(() => validateGeneration(valid, ["objective-1"], [])).toThrow());
  it("rejeita objetivo inventado", () =>
    expect(() => validateGeneration(valid, [], ["answer-1"])).toThrow());
  it("rejeita evidência de domínio sem resposta", () =>
    expect(() =>
      validateGeneration(
        { ...valid, evidence: [{ ...valid.evidence[0], answerIds: [] }] },
        ["objective-1"],
        [],
      ),
    ).toThrow());
  it("rejeita objetivos duplicados", () =>
    expect(() =>
      validateGeneration(
        { ...valid, evidence: [...valid.evidence, ...valid.evidence] },
        ["objective-1"],
        ["answer-1"],
      ),
    ).toThrow());
  it("exige uma pergunta não vazia", () =>
    expect(() =>
      validateGeneration({ ...valid, question: " " }, ["objective-1"], ["answer-1"]),
    ).toThrow());
});
describe("atividade de qualquer curso", () => {
  it.each(["Engenharia", "Letras", "Medicina", "Administração", "Pedagogia"])(
    "aceita objetivos de %s sem tipo fixo de curso",
    (course) => {
      expect(
        activityInput.safeParse({
          classroomId: "class",
          title: `Atividade de ${course}`,
          instructions: "Explique as decisões da sua entrega.",
          objectives: [
            {
              id: "objective-1",
              description: "Justificar a escolha apresentada",
              criterion: "Apresenta razões coerentes e reconhece limites.",
            },
          ],
          maxQuestions: 5,
        }).success,
      ).toBe(true);
    },
  );
  it("não aceita atividade sem objetivos", () =>
    expect(
      activityInput.safeParse({
        classroomId: "class",
        title: "Atividade",
        instructions: "Explique o seu trabalho.",
        objectives: [],
        maxQuestions: 5,
      }).success,
    ).toBe(false));
});
describe("proteção de CSV", () => {
  it.each(["=SUM(A1)", "+1", "-2", "@user", "\t=1"])("neutraliza %s", (text) =>
    expect(csvSafe(text)).toBe(`'${text}`),
  );
  it("preserva texto comum", () =>
    expect(csvSafe("Evidência suficiente")).toBe("Evidência suficiente"));
});
