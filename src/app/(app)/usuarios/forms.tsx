"use client";
import { useState } from "react";
import { ApiForm, Field } from "@/components/forms";

type UserData = { id: string; name: string; email: string; role: string; updatedAt: string };
export function UserForm({
  admin,
  user,
  classes = [],
}: {
  admin: boolean;
  user?: UserData;
  classes?: { id: string; name: string }[];
}) {
  const [role, setRole] = useState(user?.role ?? (admin ? "TEACHER" : "STUDENT"));
  const [classroom, setClassroom] = useState("");
  return (
    <ApiForm
      endpoint={`/api/v1/users${user ? `/${user.id}` : ""}`}
      method={user ? "PATCH" : "POST"}
      label={user ? "Salvar alterações" : "Cadastrar usuário"}
      destination="/usuarios?salvo=1"
      confirmMessage={(data) =>
        user &&
        ((admin && data.get("role") !== user.role) ||
          String(data.get("newPassword") ?? "") ||
          data.get("email") !== user.email)
          ? "Confirmar a alteração do acesso deste usuário? Mudanças de perfil, e-mail ou senha encerram as sessões existentes."
          : undefined
      }
      transform={(data) => ({
        name: data.get("name"),
        email: data.get("email"),
        role: admin ? data.get("role") : "STUDENT",
        ...(String(data.get("newPassword") ?? "") ? { password: data.get("newPassword") } : {}),
        ...(user
          ? { updatedAt: user.updatedAt }
          : classroom && role === "STUDENT"
            ? { classroomId: classroom, registration: data.get("registration") }
            : {}),
      })}
    >
      <Field label="Nome completo" name="name" defaultValue={user?.name} />
      <Field label="E-mail" name="email" type="email" defaultValue={user?.email} />
      {admin ? (
        <div className="field">
          <label htmlFor="user-role">Perfil</label>
          <select id="user-role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="ADMIN">Administrador</option>
            <option value="TEACHER">Professor</option>
            <option value="STUDENT">Estudante</option>
          </select>
        </div>
      ) : (
        <p>O aluno será cadastrado com perfil de estudante.</p>
      )}
      <Field
        name="newPassword"
        label={user ? "Nova senha" : "Senha inicial"}
        type="password"
        required={!user}
        hint={
          user
            ? "Deixe em branco para manter a senha atual. Uma nova senha precisa ter pelo menos 12 caracteres."
            : "Use pelo menos 12 caracteres e compartilhe a senha diretamente com a pessoa."
        }
      />
      {!user && role === "STUDENT" && (
        <>
          <div className="field">
            <label htmlFor="student-class">Vincular à turma (opcional)</label>
            <select
              id="student-class"
              value={classroom}
              onChange={(e) => setClassroom(e.target.value)}
            >
              <option value="">Cadastrar sem turma</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {classroom && <Field label="Matrícula" name="registration" />}
        </>
      )}
    </ApiForm>
  );
}
