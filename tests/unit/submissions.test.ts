import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormattedWork } from "../../src/components/formatted-work";
import { submissionInput } from "../../src/server/schemas";

const content = "Texto obrigatório com a explicação das decisões e das referências do trabalho.";

describe("entrega textual com materiais complementares", () => {
  it("mantém o texto obrigatório mesmo com link e equipe", () => {
    expect(
      submissionInput.safeParse({
        content: "",
        driveUrl: "https://drive.google.com/drive/folders/exemplo",
        isTeam: true,
        teammateIds: ["colega"],
      }).success,
    ).toBe(false);
    expect(submissionInput.parse({ content })).toMatchObject({
      content,
      contentFormat: "PLAIN",
      teammateIds: [],
      isTeam: false,
    });
  });
  it.each([
    "",
    "https://drive.google.com/file/d/exemplo/view",
    "https://docs.google.com/document/d/exemplo/edit",
  ])("aceita link opcional válido %s", (driveUrl) => {
    expect(submissionInput.safeParse({ content, driveUrl }).success).toBe(true);
  });
  it.each([
    "javascript:alert(1)",
    "http://drive.google.com/file/d/a",
    "https://drive.google.com.evil.test/a",
    "https://drive.google.com@evil.test/a",
    "https://user:pass@drive.google.com/a",
    "https://drive.google.com:8443/a",
  ])("recusa link inválido %s", (driveUrl) => {
    expect(submissionInput.safeParse({ content, driveUrl }).success).toBe(false);
  });
  it("exige equipe coerente e sem duplicações", () => {
    expect(submissionInput.safeParse({ content, isTeam: true }).success).toBe(false);
    expect(submissionInput.safeParse({ content, teammateIds: ["colega"] }).success).toBe(false);
    expect(
      submissionInput.safeParse({ content, isTeam: true, teammateIds: ["colega", "colega"] })
        .success,
    ).toBe(false);
    expect(
      submissionInput.safeParse({ content, isTeam: true, teammateIds: ["colega"] }).success,
    ).toBe(true);
  });
});

describe("formatação segura e compatibilidade", () => {
  it("formata o texto sem permitir HTML, scripts, links executáveis ou imagens remotas", () => {
    const html = renderToStaticMarkup(
      createElement(FormattedWork, {
        format: "MARKDOWN",
        content:
          "**Decisão**\n\n- justificativa\n\n<script>alert(1)</script>\n\n[Executar](javascript:alert(1))\n\n![Imagem](https://external.example/pixel.png)\n\n[Referência](https://example.test)",
      }),
    );
    expect(html).toContain("<strong>Decisão</strong>");
    expect(html).toContain("<li>justificativa</li>");
    expect(html).not.toMatch(/<script|<img|href="javascript:/);
    expect(html).toContain('href="https://example.test"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it("preserva a apresentação literal das entregas antigas", () => {
    const html = renderToStaticMarkup(
      createElement(FormattedWork, {
        format: "PLAIN",
        content: "**literal** <script>texto</script>",
      }),
    );
    expect(html).toContain("**literal**");
    expect(html).toContain("&lt;script&gt;");
  });
});
