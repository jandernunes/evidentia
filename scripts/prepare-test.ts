import { config } from "dotenv";

config({ path: ".env.test", override: true, quiet: true });

import { hashPassword } from "better-auth/crypto";
import { getDb } from "../src/server/db";

async function prepare() {
  if (!process.env.DATABASE_URL?.endsWith("/evidentia_test") || !process.env.TEST_PASSWORD)
    throw new Error("Use somente a base sintética evidentia_test.");
  const db = getDb();
  const password = await hashPassword(process.env.TEST_PASSWORD);
  for (const [email, name, role] of [
    ["admin@example.test", "Administração de teste", "ADMIN"],
    ["teacher@example.test", "Docente de teste", "TEACHER"],
    ["student@example.test", "Estudante de teste", "STUDENT"],
    ["other@example.test", "Outro docente", "TEACHER"],
  ]) {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) continue;
    const id = crypto.randomUUID();
    await db.user.create({
      data: {
        id,
        name,
        email,
        role,
        accounts: {
          create: { id: crypto.randomUUID(), providerId: "credential", accountId: id, password },
        },
      },
    });
  }
  await db.$disconnect();
  console.log("Contas sintéticas prontas. Credenciais não exibidas.");
}
prepare().catch(() => {
  console.error("Falha na preparação da base sintética.");
  process.exitCode = 1;
});
