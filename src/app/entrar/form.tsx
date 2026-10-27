"use client";
import { ApiForm, Field } from "@/components/forms";
export function LoginForm({ configured }: { configured: boolean }) {
  return (
    <fieldset disabled={!configured} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className="hint">Acesso individual</legend>
      <ApiForm
        endpoint="/api/auth/sign-in/email"
        destination="/atividades"
        label="Entrar"
        pendingLabel="Entrando…"
      >
        <Field name="email" label="E-mail" type="email" />
        <Field name="password" label="Senha" type="password" />
      </ApiForm>
    </fieldset>
  );
}
