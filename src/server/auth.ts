import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { getDb } from "./db";

let instance: ReturnType<typeof createAuth> | undefined;
export function authConfigured() {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.BETTER_AUTH_SECRET &&
      process.env.BETTER_AUTH_SECRET.length >= 32 &&
      process.env.BETTER_AUTH_URL,
  );
}
export function getAuth() {
  if (!authConfigured()) throw new Error("AUTH_NOT_CONFIGURED");
  if (!instance) instance = createAuth();
  return instance;
}
function createAuth() {
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!baseURL) throw new Error("AUTH_NOT_CONFIGURED");
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL,
    database: prismaAdapter(getDb(), { provider: "postgresql" }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
    rateLimit: { enabled: true, window: 60, max: 20 },
    session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 60 },
    trustedOrigins: [baseURL],
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await getDb().user.findUnique({
              where: { id: session.userId },
              select: { isActive: true },
            });
            if (!user?.isActive)
              throw new APIError("FORBIDDEN", {
                message: "Esta conta está desativada. Procure a administração.",
              });
          },
        },
      },
    },
  });
}
