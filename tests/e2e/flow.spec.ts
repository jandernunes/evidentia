import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { getDb } from "../../src/server/db";

const stamp = Date.now();
const course = `Letras ${stamp}`;
const discipline = `Interpretação ${stamp}`;
const classroom = `Turma ${stamp}`;
const activity = `Análise de texto ${stamp}`;
const pageErrors: string[] = [];
async function login(page: Page, email: string) {
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  if (!process.env.TEST_PASSWORD) throw new Error("Configure a senha da base sintética.");
  await page.getByLabel("Senha", { exact: true }).fill(process.env.TEST_PASSWORD);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/sign-in/email") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const response = await responsePromise;
  if (response.status() === 429) {
    const retryAfter = Number(response.headers()["retry-after"]) || 15;
    await page.waitForTimeout(Math.min(65, retryAfter + 1) * 1000);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
  }
  await expect(page).toHaveURL(/atividades/);
  await expect(page.getByRole("heading", { name: "Atividades", exact: true })).toBeVisible();
}
test("cadastro acadêmico, entrega, isolamento, retomada e revisão sem API configurada", async ({
  browser,
}, testInfo) => {
  const admin = await (
    await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  ).newPage();
  await login(admin, "admin@example.test");
  await admin.screenshot({ path: testInfo.outputPath("atividades-desktop.png"), fullPage: true });
  await admin.goto("/cursos/novo");
  await admin.getByLabel("Nome do curso").fill(course);
  await admin.getByLabel("Nível de formação").fill("Graduação");
  await admin.getByRole("button", { name: "Cadastrar curso", exact: true }).click();
  await expect(admin).toHaveURL(/cursos\?salvo=1/);
  await admin.goto("/turmas/nova");
  const disciplinePanel = admin
    .locator("section")
    .filter({ has: admin.getByRole("heading", { name: "Cadastrar disciplina", exact: true }) });
  await disciplinePanel.getByLabel("Nome da disciplina").fill(discipline);
  await disciplinePanel.getByRole("button", { name: "Cadastrar disciplina", exact: true }).click();
  await expect(disciplinePanel.getByRole("status")).toContainText("Registro salvo");
  const teacher = await (await browser.newContext()).newPage();
  await login(teacher, "teacher@example.test");
  await teacher.goto("/turmas/nova");
  await teacher.getByLabel("Nome da turma").fill(classroom);
  await teacher.getByLabel("Período", { exact: true }).fill("2026.2");
  await teacher.getByLabel("Disciplina", { exact: true }).selectOption({ label: discipline });
  await teacher.getByLabel(course, { exact: true }).check();
  await teacher.getByRole("button", { name: "Criar turma", exact: true }).click();
  await expect(teacher).toHaveURL(/turmas\?salvo=1/);
  await teacher.getByLabel("Buscar turma").fill(classroom);
  await teacher.getByRole("button", { name: "Buscar", exact: true }).click();
  await teacher.getByRole("link", { name: `Gerenciar ${classroom}`, exact: true }).click();
  await teacher
    .getByLabel("Conteúdo CSV")
    .fill("matricula,nome,email\n123,Estudante de teste,student@example.test");
  await teacher.getByRole("button", { name: "Importar participantes" }).click();
  await expect(teacher.getByRole("status").filter({ hasText: "incluido" })).toBeVisible();
  await teacher.goto("/atividades/nova");
  await teacher.getByLabel("Turma", { exact: true }).selectOption({ label: classroom });
  await teacher.getByLabel("Título da atividade").fill(activity);
  await teacher
    .getByLabel("Instruções e contexto")
    .fill(
      "Explique a interpretação do texto e justifique as escolhas com base em passagens da obra.",
    );
  await teacher
    .getByLabel("Objetivos e critérios")
    .fill(
      "Justificar a interpretação | Apresenta argumentos e reconhece outras interpretações possíveis.",
    );
  await teacher.getByRole("button", { name: "Criar atividade", exact: true }).click();
  await expect(teacher.getByRole("heading", { name: activity, exact: true })).toBeVisible();
  const activityUrl = teacher.url();
  const student = await (await browser.newContext()).newPage();
  await login(student, "student@example.test");
  await student.goto(activityUrl);
  await student
    .getByLabel("Conteúdo do trabalho")
    .fill(
      "A leitura do texto sugere um conflito entre a memória e a experiência presente. A interpretação considera as escolhas do narrador e as passagens finais da obra.",
    );
  await student.getByRole("button", { name: "Enviar trabalho" }).click();
  await expect(
    student.getByText("Aguardando liberação do professor", { exact: true }),
  ).toBeVisible();
  await teacher.reload();
  await teacher.getByRole("button", { name: "Liberar arguição" }).click();
  await expect(teacher).toHaveURL(/sessoes/);
  const examUrl = teacher.url();
  await teacher.getByRole("button", { name: "Preparar próxima pergunta" }).click();
  await expect(
    teacher.getByRole("alert").filter({ hasText: "IA ainda não está configurada" }),
  ).toBeVisible();
  const db = getDb();
  const examId = examUrl.split("/").at(-1);
  if (!examId) throw new Error("Sessão não encontrada no teste.");
  // A pergunta sintética permite testar persistência sem chamar um provedor pago.
  const exam = await db.exam.findUniqueOrThrow({ where: { id: examId } });
  const snapshot = exam.snapshot as { objectives: { id: string }[] };
  await db.question.create({
    data: {
      examId,
      position: 1,
      objectiveId: snapshot.objectives[0].id,
      text: "Qual passagem sustenta sua interpretação?",
      reason: "Caso sintético de teste.",
    },
  });
  await db.exam.update({ where: { id: examId }, data: { status: "WAITING" } });
  await student.goto(examUrl);
  await student
    .getByLabel("Sua resposta", { exact: true })
    .fill("A passagem final retoma a imagem inicial e muda a perspectiva do narrador.");
  await student.getByRole("button", { name: "Salvar resposta", exact: true }).click();
  await expect(
    student.getByText("Resposta salva. Você pode continuar", { exact: false }),
  ).toBeVisible();
  await student.reload();
  await expect(
    student.getByText("A passagem final retoma a imagem inicial", { exact: false }),
  ).toBeVisible();
  const other = await (await browser.newContext()).newPage();
  await login(other, "other@example.test");
  const forbidden = await other.request.get(`/api/v1/exams/${examId}`);
  expect(forbidden.status()).toBe(404);
  await teacher.reload();
  await teacher.getByText("Encerramento pelo professor", { exact: true }).click();
  await teacher.getByRole("button", { name: "Encerrar esta sessão", exact: true }).click();
  await expect(teacher.getByRole("heading", { name: "Revisar e liberar resultado" })).toBeVisible();
  await teacher
    .getByLabel("Justificativa da revisão", { exact: true })
    .fill("Sessão técnica encerrada com objetivo ainda não avaliado.");
  await teacher.getByLabel("Liberar o resultado ao estudante").check();
  await teacher.getByRole("button", { name: "Salvar revisão", exact: true }).click();
  await expect(
    teacher.getByText("Decisão revisada pelo professor.", { exact: true }),
  ).toBeVisible();
  await student.reload();
  await expect(student.getByRole("heading", { name: "Mapa de evidências" })).toBeVisible();
  const activityId = activityUrl.split("/").at(-1);
  const jsonExport = await teacher.request.get(
    `/api/v1/activities/${activityId}/results?format=json`,
  );
  expect(jsonExport.status()).toBe(200);
  const exported = await jsonExport.json();
  expect(exported.schemaVersion).toBe(1);
  expect(exported.results[0].reviewed).toBe(true);
  const csvExport = await teacher.request.get(
    `/api/v1/activities/${activityId}/results?format=csv`,
  );
  expect(csvExport.headers()["content-type"]).toContain("text/csv");
  expect(await csvExport.text()).toContain("REVISADO");
  expect(
    (await other.request.get(`/api/v1/activities/${activityId}/results?format=json`)).status(),
  ).toBe(404);
  expect(
    (await student.request.get(`/api/v1/activities/${activityId}/results?format=json`)).status(),
  ).toBe(403);
  for (const width of [320, 360, 768, 1024, 1440]) {
    await teacher.setViewportSize({ width, height: 1000 });
    await teacher.goto("/atividades");
    expect(
      await teacher.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  const accessibility = await new AxeBuilder({ page: teacher })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  for (const route of ["/turmas", "/atividades/nova", activityUrl, examUrl, "/configuracao"]) {
    await teacher.goto(route);
    await expect(teacher.getByRole("heading", { level: 1 })).toBeVisible();
    for (const width of [320, 1440]) {
      await teacher.setViewportSize({ width, height: 1000 });
      expect(
        await teacher.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    const result = await new AxeBuilder({ page: teacher })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  expect(pageErrors).toEqual([]);
  await teacher.goto("/atividades");
  await expect(teacher.getByRole("heading", { name: "Atividades", exact: true })).toBeVisible();
  await teacher.setViewportSize({ width: 360, height: 900 });
  await teacher.screenshot({ path: testInfo.outputPath("atividades-mobile.png"), fullPage: true });
  await db.$disconnect();
  await admin.close();
  await student.close();
  await teacher.close();
  await other.close();
});
