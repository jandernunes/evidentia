"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function SignOut() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function logout() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error();
      router.push("/entrar");
      router.refresh();
    } catch {
      setError("Não foi possível sair. Tente novamente.");
      setPending(false);
    }
  }
  return (
    <>
      <button type="button" className="text-button" onClick={logout} disabled={pending}>
        {pending ? "Saindo…" : "Sair da conta"}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
