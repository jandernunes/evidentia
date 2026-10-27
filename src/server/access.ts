import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authConfigured, getAuth } from "./auth";
import { getDb } from "./db";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function currentUser() {
  if (!authConfigured()) return null;
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session
    ? getDb().user.findFirst({ where: { id: session.user.id, isActive: true } })
    : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Entre na sua conta para continuar.");
  return user;
}
export async function pageUser() {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  return user;
}
export function requireTeacher(user: { role: string }) {
  if (!["TEACHER", "ADMIN"].includes(user.role))
    throw new AppError(403, "FORBIDDEN", "Esta ação está disponível para docentes autorizados.");
}
export function classScope(user: { id: string; role: string }) {
  if (user.role === "ADMIN") return {};
  return user.role === "STUDENT"
    ? { enrollments: { some: { studentId: user.id } } }
    : { teacherId: user.id };
}
export function managedUserScope(user: { id: string; role: string }) {
  requireTeacher(user);
  return user.role === "ADMIN"
    ? {}
    : {
        role: "STUDENT",
        OR: [
          { createdById: user.id },
          { enrollments: { some: { classroom: { teacherId: user.id } } } },
        ],
      };
}
