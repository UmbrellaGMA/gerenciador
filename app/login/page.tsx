"use client";

import { useActionState } from "react";
import { signIn } from "../actions";
import { SubmitButton } from "@/components/ui";

export default function LoginPage() {
  const [state, action] = useActionState(signIn, null);
  const input =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <h1 className="text-xl font-semibold">Painel de Clientes</h1>
          <p className="text-sm text-zinc-500">Entre para continuar</p>
        </div>
        <input name="email" type="email" required placeholder="E-mail" className={input} autoComplete="email" />
        <input name="password" type="password" required placeholder="Senha" className={input} autoComplete="current-password" />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <SubmitButton className="w-full" pendingText="Entrando…">
          Entrar
        </SubmitButton>
      </form>
    </main>
  );
}
