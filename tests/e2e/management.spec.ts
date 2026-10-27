import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { getDb } from "../../src/server/db";

const origin = "http://localhost:3100";
const headers = { origin };
async function login(page: Page, email: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(process.env.TEST_PASSWORD ?? "");
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/sign-in/email") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const response = await responsePromise;
  if (response.status() === 429) {
    await page.waitForTimeout(
      Math.min(65, (Number(response.headers()["retry-after"]) || 15) + 1) * 1000,
    );
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
  }
  await expect(page).toHaveURL(/atividades/);
}
test("gestão completa por perfil, proteção de acesso e telas responsivas e acessíveis", async ({
  browser,
}, info) => {
  test.setTimeout(360000);
  if (!process.env.DATABASE_URL?.endsWith("/evidentia_test")) throw Error("Use a base sintética");
  const db = getDb();
  const stamp = Date.now();
  const errors: string[] = [];
  const admin = await (
    await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  ).newPage();
  admin.on("pageerror", (e) => errors.push(e.message));
  await login(admin, "admin@example.test");
  const createdUsers = [];
  for (const role of ["ADMIN", "TEACHER", "STUDENT"]) {
    await admin.goto("/usuarios/novo");
    await admin.getByLabel("Nome completo").fill(`UI ${role} ${stamp}`);
    await admin.getByLabel("E-mail", { exact: true }).fill(`ui-${role}-${stamp}@example.test`);
    await admin.getByLabel("Perfil", { exact: true }).selectOption(role);
    await admin.getByLabel("Senha inicial").fill(process.env.TEST_PASSWORD ?? "");
    await admin.getByRole("button", { name: "Cadastrar usuário", exact: true }).click();
    await expect(admin).toHaveURL(/usuarios\?salvo=1/);
    createdUsers.push(
      await db.user.findUniqueOrThrow({
        where: { email: `ui-${role}-${stamp}@example.test`.toLowerCase() },
      }),
    );
  }
  const user = createdUsers[2];
  await admin.goto(`/usuarios/${user.id}`);
  await admin.getByLabel("Nome completo").fill(`UI aluno editado ${stamp}`);
  await admin.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(admin).toHaveURL(/usuarios\?salvo=1/);
  const fresh = await (await browser.newContext()).newPage();
  await login(fresh, user.email);
  await admin.goto(`/usuarios/${user.id}`);
  const deactivate = admin.getByRole("button", { name: "Desativar cadastro", exact: true });
  await deactivate.click();
  await expect(admin.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
  await admin.keyboard.press("Escape");
  await expect(deactivate).toBeFocused();
  await deactivate.click();
  await admin.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(admin.getByRole("button", { name: "Reativar cadastro", exact: true })).toBeVisible();
  await fresh.goto("/atividades");
  await expect(fresh).toHaveURL(/entrar/);
  await fresh.getByLabel("E-mail", { exact: true }).fill(user.email);
  await fresh.getByLabel("Senha", { exact: true }).fill(process.env.TEST_PASSWORD ?? "");
  await fresh.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    fresh.getByRole("alert").filter({ hasText: "Não foi possível entrar" }),
  ).toBeVisible();
  await admin.getByRole("button", { name: "Reativar cadastro", exact: true }).click();
  await admin.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    admin.getByRole("button", { name: "Desativar cadastro", exact: true }),
  ).toBeVisible();
  // Validação de servidor também para chamadas forjadas.
  const teacher = await (await browser.newContext()).newPage();
  await login(teacher, "teacher@example.test");
  await teacher.goto("/usuarios/novo");
  await expect(teacher.getByLabel("Perfil", { exact: true })).toHaveCount(0);
  expect(
    (
      await teacher.request.post("/api/v1/users", {
        headers,
        data: {
          name: "Escalada",
          email: `escalation-${stamp}@example.test`,
          role: "ADMIN",
          password: process.env.TEST_PASSWORD,
        },
      })
    ).status(),
  ).toBe(403);
  await teacher.getByLabel("Nome completo").fill(`Aluno professor ${stamp}`);
  await teacher.getByLabel("E-mail", { exact: true }).fill(`teacher-student-${stamp}@example.test`);
  await teacher.getByLabel("Senha inicial").fill(process.env.TEST_PASSWORD ?? "");
  await teacher.getByRole("button", { name: "Cadastrar usuário", exact: true }).click();
  await expect(teacher).toHaveURL(/usuarios\?salvo=1/);
  await teacher.goto("/cursos/novo");
  await teacher.getByLabel("Nome do curso").fill(`Curso UI ${stamp}`);
  await teacher.getByLabel("Nível de formação").fill("Graduação");
  await teacher.getByRole("button", { name: "Cadastrar curso", exact: true }).click();
  await expect(teacher).toHaveURL(/cursos\?salvo=1/);
  const course = await db.course.findUniqueOrThrow({ where: { name: `Curso UI ${stamp}` } });
  await teacher.goto(`/cursos/${course.id}`);
  await teacher.getByLabel("Nome do curso").fill(`Curso UI revisado ${stamp}`);
  await teacher.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(teacher).toHaveURL(/cursos\?salvo=1/);
  const discipline = await db.discipline.create({ data: { name: `Disciplina UI ${stamp}` } });
  await teacher.goto("/turmas/nova");
  await teacher.getByLabel("Nome da turma").fill(`Turma UI ${stamp}`);
  await teacher.getByLabel("Período", { exact: true }).fill("2026.2");
  await teacher.getByLabel("Disciplina", { exact: true }).selectOption(discipline.id);
  await teacher.getByLabel(`Curso UI revisado ${stamp}`, { exact: true }).check();
  await teacher.getByRole("button", { name: "Criar turma", exact: true }).click();
  await expect(teacher).toHaveURL(/turmas\?salvo=1/);
  const classroom = await db.classroom.findFirstOrThrow({ where: { name: `Turma UI ${stamp}` } });
  await admin.goto(`/turmas/${classroom.id}`);
  await admin.getByLabel("Nome da turma").fill(`Turma UI revisada ${stamp}`);
  await admin.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(admin).toHaveURL(/turmas\?salvo=1/);
  await teacher.goto(`/turmas/${classroom.id}`);
  await teacher.getByLabel("E-mail do aluno").fill(user.email);
  await teacher.getByLabel("Matrícula", { exact: true }).fill(`ui-${stamp}`);
  await teacher.getByRole("button", { name: "Vincular aluno", exact: true }).click();
  await expect(
    teacher.getByRole("link", { name: `UI aluno editado ${stamp}`, exact: true }),
  ).toBeVisible();
  await teacher.goto(`/usuarios/${user.id}`);
  await expect(teacher.getByLabel("Nova senha")).toHaveCount(0);
  expect(
    (
      await teacher.request.patch(`/api/v1/users/${user.id}`, {
        headers,
        data: {
          updatedAt: (
            await db.user.findUniqueOrThrow({ where: { id: user.id } })
          ).updatedAt.toISOString(),
          isActive: false,
        },
      })
    ).status(),
  ).toBe(404);
  const student = await (await browser.newContext()).newPage();
  await login(student, "student@example.test");
  for (const route of ["/usuarios", "/usuarios/novo", "/cursos/novo", "/turmas/nova"]) {
    await student.goto(route);
    await expect(student.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  }
  expect(
    (
      await student.request.post("/api/v1/courses", {
        headers,
        data: { name: "Inválido", level: "Graduação" },
      })
    ).status(),
  ).toBe(403);
  const routes = [
    "/cursos",
    "/cursos/novo",
    `/cursos/${course.id}`,
    "/turmas",
    "/turmas/nova",
    `/turmas/${classroom.id}`,
    "/usuarios",
    "/usuarios/novo",
    `/usuarios/${user.id}`,
  ];
  for (const route of routes) {
    await admin.goto(route);
    await expect(admin.getByRole("heading", { level: 1 })).toBeVisible();
    for (const width of [320, 1440]) {
      await admin.setViewportSize({ width, height: 1000 });
      expect(
        await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    expect(
      (
        await new AxeBuilder({ page: admin })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await admin.goto(`/turmas/${classroom.id}`);
  await expect(
    admin.getByRole("heading", { name: `Turma UI revisada ${stamp}`, exact: true }),
  ).toBeVisible();
  await expect(admin.getByText("Carregando a página…", { exact: true })).toHaveCount(0);
  await expect(admin.getByRole("button", { name: "Salvar alterações", exact: true })).toBeEnabled();
  await expect(admin.getByLabel("Nome da turma")).toHaveValue(`Turma UI revisada ${stamp}`);
  await admin.screenshot({ path: info.outputPath("gestao-desktop.png"), fullPage: true });
  await admin.setViewportSize({ width: 360, height: 900 });
  await admin.screenshot({ path: info.outputPath("gestao-mobile.png"), fullPage: true });
  await admin.getByRole("button", { name: "Excluir cadastro", exact: true }).click();
  await admin.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    admin.getByRole("alert").filter({ hasText: "participantes ou atividades" }),
  ).toBeVisible();
  await admin
    .getByRole("button", { name: `Remover UI aluno editado ${stamp}`, exact: true })
    .click();
  await admin.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(admin.getByText("Nenhum participante vinculado.")).toBeVisible();
  for (const route of [`/turmas/${classroom.id}`, `/cursos/${course.id}`, `/usuarios/${user.id}`]) {
    await admin.goto(route);
    await admin.getByRole("button", { name: "Excluir cadastro", exact: true }).click();
    await admin.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(admin).toHaveURL(/excluido=1/);
  }
  expect(errors).toEqual([]);
  await db.$disconnect();
  await admin.context().close();
  await teacher.context().close();
  await student.context().close();
  await fresh.context().close();
});
