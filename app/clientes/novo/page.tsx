import Link from "next/link";
import { ClientForm } from "@/components/ClientForm";
import { createClientAction } from "../../actions";

export default function NovoCliente() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Voltar
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold">Novo cliente</h1>
      <ClientForm action={createClientAction} submitLabel="Cadastrar e testar conexão" />
    </main>
  );
}
