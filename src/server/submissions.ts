import { z } from "zod";
import { AppError, classScope, requireTeacher } from "./access";
import { getDb } from "./db";
import { submissionInput } from "./schemas";

type Actor = { id: string; role: string };

export async function submitWork(activityId: string, user: Actor, input: unknown) {
  if (user.role !== "STUDENT")
    throw new AppError(403, "FORBIDDEN", "A entrega deve ser feita pela conta do estudante.");
  const data = submissionInput.parse(input);
  if (data.teammateIds.includes(user.id))
    throw new AppError(
      400,
      "INVALID_TEAM",
      "Você já faz parte da entrega. Selecione apenas os colegas.",
    );
  const studentIds = [user.id, ...data.teammateIds];
  return getDb().$transaction(async (tx) => {
    // Usa o mesmo lock da gestão para preservar matrícula e acesso durante o envio.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(260126)`;
    const activity = await tx.activity.findFirst({
      where: { id: activityId, classroom: { ...classScope(user), isActive: true } },
      select: { classroomId: true },
    });
    if (!activity) throw new AppError(404, "NOT_FOUND", "Atividade não encontrada.");
    const students = await tx.enrollment.count({
      where: {
        classroomId: activity.classroomId,
        studentId: { in: studentIds },
        student: { isActive: true, role: "STUDENT" },
      },
    });
    if (students !== studentIds.length)
      throw new AppError(400, "INVALID_TEAM", "Selecione somente alunos ativos desta turma.");
    if (await tx.submissionMember.count({ where: { activityId, studentId: { in: studentIds } } }))
      throw new AppError(
        409,
        "ALREADY_SUBMITTED",
        "Você ou um dos colegas já possui entrega nesta atividade. Atualize a página e confira a equipe.",
      );
    return tx.submission.create({
      data: {
        activityId,
        studentId: user.id,
        content: data.content,
        contentFormat: data.contentFormat,
        driveUrl: data.driveUrl || null,
        members: { create: studentIds.map((studentId) => ({ studentId })) },
      },
      select: { id: true },
    });
  });
}

export async function releaseSubmission(id: string, user: Actor, input: unknown) {
  requireTeacher(user);
  const { studentId } = z.object({ studentId: z.string().min(1).optional() }).parse(input);
  return getDb().$transaction(async (tx) => {
    const submission = await tx.submission.findFirst({
      where: { id, activity: { classroom: classScope(user) } },
      include: {
        members: { include: { student: { select: { id: true, name: true } } } },
        activity: { include: { classroom: { include: { discipline: true, courses: true } } } },
      },
    });
    if (!submission) throw new AppError(404, "NOT_FOUND", "Entrega não encontrada.");
    const targetId = studentId ?? submission.studentId;
    const participant = submission.members.find((member) => member.studentId === targetId);
    if (!participant)
      throw new AppError(404, "NOT_FOUND", "Participante não encontrado nesta entrega.");
    const activity = submission.activity;
    return tx.exam.upsert({
      where: { submissionId_studentId: { submissionId: id, studentId: targetId } },
      create: {
        submissionId: id,
        studentId: targetId,
        snapshot: {
          title: activity.title,
          instructions: activity.instructions,
          objectives: activity.objectives,
          work: submission.content,
          workFormat: submission.contentFormat,
          participants: submission.members.map((member) => member.student),
          examinee: participant.student,
          maxQuestions: activity.maxQuestions,
          discipline: activity.classroom.discipline.name,
          courses: activity.classroom.courses.map((course) => `${course.name} (${course.level})`),
        },
      },
      update: {},
      select: { id: true },
    });
  });
}
