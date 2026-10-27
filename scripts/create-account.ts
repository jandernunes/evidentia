import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { getDb } from "../src/server/db";

async function main() {
  const data = z
    .object({
      ACCOUNT_NAME: z.string().min(2),
      ACCOUNT_EMAIL: z.email(),
      ACCOUNT_PASSWORD: z.string().min(8),
      ACCOUNT_ROLE: z.enum(["ADMIN", "TEACHER", "STUDENT"]),
    })
    .parse(process.env);
  const db = getDb();
  const userId = crypto.randomUUID();
  const password = await hashPassword(data.ACCOUNT_PASSWORD);
  await db.user.create({
    data: {
      id: userId,
      name: data.ACCOUNT_NAME,
      email: data.ACCOUNT_EMAIL.toLowerCase(),
      role: data.ACCOUNT_ROLE,
      accounts: {
        create: { id: crypto.randomUUID(), accountId: userId, providerId: "credential", password },
      },
    },
  });
  console.log("Conta criada. A senha não é exibida nem enviada por e-mail.");
  await db.$disconnect();
}
main().catch(() => {
  console.error(
    "Não foi possível criar a conta. Confira as variáveis ACCOUNT_*, a conexão e se o e-mail já existe.",
  );
  process.exitCode = 1;
});
