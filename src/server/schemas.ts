import { z } from "zod";

const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Informe pelo menos ${min} caracteres.`)
    .max(max, `Use até ${max} caracteres.`);
export const courseInput = z.object({ name: text(2, 160), level: text(2, 80) });
export const disciplineInput = z.object({ name: text(2, 160) });
export const classInput = z.object({
  name: text(2, 160),
  period: text(2, 40),
  disciplineId: text(1, 100),
  courseIds: z.array(text(1, 100)).min(1).max(20),
  teacherId: text(1, 100).optional(),
});
export const roleSchema = z.enum(["ADMIN", "TEACHER", "STUDENT"]);
export const newUserInput = z
  .object({
    name: text(2, 160),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().min(12, "A senha precisa ter pelo menos 12 caracteres.").max(128),
    role: roleSchema,
    classroomId: text(1, 100).optional(),
    registration: text(1, 60).optional(),
  })
  .strict();
export const userUpdateInput = z
  .object({
    name: text(2, 160).optional(),
    email: z.string().trim().toLowerCase().pipe(z.email()).optional(),
    password: z
      .string()
      .min(12, "A senha precisa ter pelo menos 12 caracteres.")
      .max(128)
      .optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export const courseUpdateInput = courseInput
  .partial()
  .extend({ isActive: z.boolean().optional(), updatedAt: z.iso.datetime() })
  .strict();
export const classUpdateInput = classInput
  .partial()
  .extend({ isActive: z.boolean().optional(), updatedAt: z.iso.datetime() })
  .strict();
export const enrollmentInput = z
  .object({ email: z.string().trim().toLowerCase().pipe(z.email()), registration: text(1, 60) })
  .strict();
export const objectiveSchema = z.object({
  id: z.string(),
  description: text(5, 500),
  criterion: text(5, 1000),
});
export const activityInput = z.object({
  classroomId: text(1, 100),
  title: text(3, 160),
  instructions: text(10, 5000),
  objectives: z.array(objectiveSchema).min(1).max(8),
  maxQuestions: z.number().int().min(1).max(5),
});
export const submissionInput = z.object({ content: text(50, 20_000) });
export const answerInput = z.object({
  questionId: text(1, 100),
  text: text(1, 5000),
  version: z.number().int().nonnegative(),
});
export const evidenceSchema = z.object({
  objectiveId: z.string(),
  state: z.enum([
    "NAO_AVALIADO",
    "EVIDENCIA_INSUFICIENTE",
    "EVIDENCIA_PARCIAL",
    "EVIDENCIA_SUFICIENTE",
  ]),
  reason: z.string().min(1).max(2000),
  answerIds: z.array(z.string()).max(5),
});
export const generationSchema = z.object({
  action: z.enum(["ASK", "FINISH"]),
  objectiveId: z.string(),
  question: z.string().max(1500),
  reason: z.string().min(1).max(1500),
  evidence: z.array(evidenceSchema).max(8),
});
export const snapshotSchema = z.object({
  title: z.string(),
  instructions: z.string(),
  discipline: z.string(),
  courses: z.array(z.string()),
  maxQuestions: z.number(),
  objectives: z.array(objectiveSchema),
  work: z.string(),
});
export function validateGeneration(data: unknown, objectiveIds: string[], answerIds: string[]) {
  const value = generationSchema.parse(data);
  if (
    (value.action === "ASK" &&
      (!value.question.trim() || !objectiveIds.includes(value.objectiveId))) ||
    new Set(value.evidence.map((e) => e.objectiveId)).size !== value.evidence.length
  )
    throw new Error("Invalid generation");
  for (const evidence of value.evidence) {
    if (
      !objectiveIds.includes(evidence.objectiveId) ||
      evidence.answerIds.some((id) => !answerIds.includes(id)) ||
      (evidence.state !== "NAO_AVALIADO" && evidence.answerIds.length === 0)
    )
      throw new Error("Unsupported evidence");
  }
  return value;
}
export function csvSafe(value: string) {
  return /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
}
