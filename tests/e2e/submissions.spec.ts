import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { getDb } from "../../src/server/db";

async function login(page: Page, email: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(process.env.TEST_PASSWORD ?? "");
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/api/auth/sign-in/email") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const result = await pending;
  if (result.status() === 429) {
    await page.waitForTimeout(
      Math.min(65, (Number(result.headers()["retry-after"]) || 15) + 1) * 1000,
    );
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
  }
  await expect(page).toHaveURL(/atividades/);
}

test("texto formatado, Drive restrito ao docente e equipe com sessões individuais", async ({
  browser,
}, info) => {
  test.setTimeout(360_000);
  if (!process.env.DATABASE_URL?.endsWith("/evidentia_test"))
    throw Error("Use somente a base sintética.");
  const db = getDb();
  const stamp = crypto.randomUUID();
  const password = await hashPassword(process.env.TEST_PASSWORD ?? "");
  const students = await Promise.all(
    [0, 1, 2].map((n) => {
      const id = `team-${n}-${stamp}`;
      return db.user.create({
        data: {
          id,
          name: `Integrante ${n} ${stamp}`,
          email: `team-${n}-${stamp}@example.test`,
          role: "STUDENT",
          accounts: {
            create: { id: crypto.randomUUID(), accountId: id, providerId: "credential", password },
          },
        },
      });
    }),
  );
  const teacher = await db.user.findUniqueOrThrow({ where: { email: "teacher@example.test" } });
  const classroom = await db.classroom.create({
    data: {
      name: `Equipe ${stamp}`,
      period: "2026.2",
      teacher: { connect: { id: teacher.id } },
      discipline: { create: { name: `Projeto ${stamp}` } },
      enrollments: {
        create: students.map((s, n) => ({ studentId: s.id, registration: String(n) })),
      },
    },
  });
  const activity = await db.activity.create({
    data: {
      classroomId: classroom.id,
      title: `Trabalho em equipe ${stamp}`,
      instructions: "Explique as decisões e as limitações do trabalho.",
      objectives: [
        {
          id: "obj",
          description: "Justificar a decisão",
          criterion: "Explica sua escolha e reconhece limites.",
        },
      ],
    },
  });
  const author = await (
    await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  ).newPage();
  const peer = await (await browser.newContext()).newPage();
  const professor = await (await browser.newContext()).newPage();
  const errors: string[] = [];
  author.on("pageerror", (e) => errors.push(e.message));
  peer.on("pageerror", (e) => errors.push(e.message));
  professor.on("pageerror", (e) => errors.push(e.message));
  await login(author, students[0].email);
  await author.goto(`/atividades/${activity.id}`);
  await expect(author.getByRole("heading", { name: activity.title, exact: true })).toBeVisible();
  const editor = author.getByLabel("Conteúdo do trabalho", { exact: true });
  const text =
    "A análise reúne as decisões da equipe e explica os limites das informações disponíveis para o trabalho.";
  await editor.fill(text);
  await editor.press("ControlOrMeta+A");
  await author.getByRole("button", { name: "Negrito", exact: true }).click();
  await expect(editor).toHaveValue(`**${text}**`);
  await author.getByRole("button", { name: "Ver prévia", exact: true }).click();
  await expect(author.locator(".work-preview strong")).toHaveText(text);
  await author.getByLabel("Este trabalho é em equipe", { exact: true }).check();
  await author.getByLabel(students[1].name, { exact: true }).focus();
  await author.keyboard.press("Space");
  await expect(author.getByLabel(students[1].name, { exact: true })).toBeChecked();
  await author
    .getByLabel("Link do Google Drive", { exact: false })
    .fill("https://evil.example/material");
  await author.getByRole("button", { name: "Enviar trabalho", exact: true }).click();
  const dialog = author.getByRole("dialog", { name: "Confirmar ação", exact: true });
  await expect(dialog.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    author.getByRole("alert").filter({ hasText: "Informe um link HTTPS" }),
  ).toBeVisible();
  await expect(editor).toHaveValue(`**${text}**`);
  const driveUrl = "https://drive.google.com/drive/folders/material-sintetico";
  await author.getByLabel("Link do Google Drive", { exact: false }).fill(driveUrl);
  for (const width of [320, 360, 768, 1024, 1440]) {
    await author.setViewportSize({ width, height: 1000 });
    expect(
      await author.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  const axe = await new AxeBuilder({ page: author })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await author.screenshot({ path: info.outputPath("entrega-desktop.png"), fullPage: true });
  await author.setViewportSize({ width: 360, height: 900 });
  await author.screenshot({ path: info.outputPath("entrega-mobile.png"), fullPage: true });
  await author.getByRole("button", { name: "Enviar trabalho", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(editor).toHaveValue(`**${text}**`);
  await author.getByRole("button", { name: "Enviar trabalho", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    author.getByText("Aguardando liberação do professor", { exact: true }),
  ).toBeVisible();
  await expect(author.getByRole("button", { name: "Enviar trabalho", exact: true })).toHaveCount(0);
  await login(peer, students[1].email);
  await peer.goto(`/atividades/${activity.id}`);
  await expect(peer.getByText("Aguardando liberação do professor", { exact: true })).toBeVisible();
  await expect(peer.getByRole("button", { name: "Enviar trabalho", exact: true })).toHaveCount(0);
  await peer.getByText("Consultar trabalho", { exact: true }).click();
  await expect(peer.locator(".formatted-work strong")).toHaveText(text);
  await expect(
    peer.getByRole("link", { name: "Consultar materiais no Drive", exact: false }),
  ).toHaveCount(0);
  await login(professor, teacher.email);
  await professor.goto(`/atividades/${activity.id}`);
  await expect(
    professor.getByRole("link", { name: "Consultar materiais no Drive", exact: false }),
  ).toHaveAttribute("href", driveUrl);
  await professor
    .getByRole("button", { name: `Liberar arguição de ${students[0].name}`, exact: true })
    .click();
  await expect(professor).toHaveURL(/sessoes/);
  const firstId = professor.url().split("/").at(-1);
  await professor.goto(`/atividades/${activity.id}`);
  await professor
    .getByRole("button", { name: `Liberar arguição de ${students[1].name}`, exact: true })
    .click();
  await expect(professor).toHaveURL(/sessoes/);
  const secondId = professor.url().split("/").at(-1);
  expect(firstId).not.toBe(secondId);
  expect((await peer.request.get(`/api/v1/exams/${firstId}`)).status()).toBe(404);
  expect((await peer.request.get(`/api/v1/exams/${secondId}`)).status()).toBe(200);
  const other = await (await browser.newContext()).newPage();
  await login(other, students[2].email);
  await other.goto(`/atividades/${activity.id}`);
  await expect(other.getByRole("button", { name: "Enviar trabalho", exact: true })).toBeVisible();
  await expect(other.getByText("Consultar trabalho", { exact: true })).toHaveCount(0);
  await expect(other.getByLabel(students[1].name, { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
  await Promise.all([author.close(), peer.close(), professor.close(), other.close()]);
  await db.$disconnect();
});
