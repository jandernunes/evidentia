import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiForm, Field } from "@/components/forms";
import {
  ActiveLabel,
  type ListParams,
  listState,
  Pagination,
  TableRegion,
} from "@/components/management";
import { ConfirmAction, RecordActions } from "@/components/record-actions";
import { PageHeading } from "@/components/ui";
import { classScope, pageUser } from "@/server/access";
import { getDb } from "@/server/db";
import { ClassForm } from "../forms";
export const metadata = { title: "Gerenciar turma" };
export default async function ClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ListParams>;
}) {
  const actor = await pageUser();
  const { id } = await params;
  const db = getDb();
  const record = await db.classroom.findFirst({
    where: { id, ...classScope(actor) },
    include: { courses: true, discipline: true, teacher: { select: { name: true } } },
  });
  if (!record) notFound();
  if (actor.role === "STUDENT")
    return (
      <>
        <PageHeading
          title={record.name}
          description={`${record.discipline.name} · ${record.period}`}
        />
        <section className="panel">
          <h2>Dados da turma</h2>
          <p>Responsável: {record.teacher.name}</p>
          <p>Cursos: {record.courses.map((c) => c.name).join(", ")}</p>
          <ActiveLabel active={record.isActive} />
        </section>
        <Link href="/turmas">Voltar à lista</Link>
      </>
    );
  const state = listState(await searchParams);
  const total = await db.enrollment.count({ where: { classroomId: id } });
  const page = Math.min(state.page, Math.max(1, Math.ceil(total / 20)));
  const [courses, disciplines, teachers, enrollments] = await Promise.all([
    db.course.findMany({
      where: { OR: [{ isActive: true }, { classes: { some: { id } } }] },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.discipline.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    actor.role === "ADMIN"
      ? db.user.findMany({
          where: {
            OR: [{ isActive: true, role: { in: ["ADMIN", "TEACHER"] } }, { id: record.teacherId }],
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : undefined,
    db.enrollment.findMany({
      where: { classroomId: id },
      select: {
        id: true,
        registration: true,
        student: { select: { id: true, name: true, email: true, isActive: true } },
      },
      orderBy: { id: "asc" },
      skip: (page - 1) * 20,
      take: 20,
    }),
  ]);
  return (
    <>
      <PageHeading
        title={record.name}
        description={`${record.discipline.name} · ${record.period}`}
      />
      <section className="panel">
        <h2>Dados da turma</h2>
        <ClassForm
          courses={courses}
          disciplines={disciplines}
          teachers={teachers}
          record={{ ...record, updatedAt: record.updatedAt.toISOString() }}
        />
      </section>
      <RecordActions
        resource="classes"
        id={id}
        name={record.name}
        isActive={record.isActive}
        updatedAt={record.updatedAt.toISOString()}
        destination="/turmas"
      />
      <section className="panel">
        <h2>Participantes</h2>
        <p>
          <Link className="button secondary" href="/usuarios/novo">
            Cadastrar aluno
          </Link>
        </p>
        <TableRegion label="Participantes da turma">
          <table>
            <caption>Alunos vinculados</caption>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">E-mail</th>
                <th scope="col">Matrícula</th>
                <th scope="col">Situação</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/usuarios/${e.student.id}`}>{e.student.name}</Link>
                  </td>
                  <td>{e.student.email}</td>
                  <td>{e.registration}</td>
                  <td>
                    <ActiveLabel active={e.student.isActive} />
                  </td>
                  <td>
                    <ConfirmAction
                      endpoint={`/api/v1/classes/${id}/enrollments/${e.id}`}
                      method="DELETE"
                      body={{}}
                      label={`Remover ${e.student.name}`}
                      message={`Remover ${e.student.name} desta turma? A conta do aluno será mantida. Alunos com entregas não podem ser removidos.`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!enrollments.length && <p className="table-empty">Nenhum participante vinculado.</p>}
        </TableRegion>
        <Pagination {...state} page={page} total={total} base={`/turmas/${id}`} />
      </section>
      {record.isActive ? (
        <>
          <section className="panel">
            <h2>Vincular aluno existente</h2>
            <ApiForm endpoint={`/api/v1/classes/${id}/enrollments`} label="Vincular aluno">
              <Field label="E-mail do aluno" name="email" type="email" />
              <Field label="Matrícula" name="registration" />
            </ApiForm>
          </section>
          <section className="panel">
            <h2>Vincular participantes por CSV</h2>
            <p>As contas devem existir. A importação apenas vincula estudantes à turma.</p>
            <ApiForm endpoint={`/api/v1/classes/${id}/import`} label="Importar participantes">
              <Field
                name="csv"
                label="Conteúdo CSV"
                type="textarea"
                hint="Cabeçalho: matricula,nome,email. Até 200 linhas. Uma importação repetida não duplica participantes."
              />
            </ApiForm>
          </section>
        </>
      ) : (
        <p className="notice">Reative a turma para vincular participantes.</p>
      )}
      <Link href="/turmas">Voltar à lista</Link>
    </>
  );
}
