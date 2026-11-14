import type { Client } from "@/lib/types";
import { SubmitButton } from "./ui";

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-800";

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function ClientForm({
  action,
  client,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  client?: Client;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do cliente *">
          <input name="name" required defaultValue={client?.name} className={input} placeholder="Padaria do João" />
        </Field>
        <Field label="Contato" hint="E-mail, WhatsApp…">
          <input name="contact" defaultValue={client?.contact ?? ""} className={input} placeholder="(11) 99999-9999" />
        </Field>
        <Field label="URL do site">
          <input name="site_url" defaultValue={client?.site_url ?? ""} className={input} placeholder="https://padariadojoao.com.br" />
        </Field>
        <Field label="Mensalidade (R$)">
          <input name="monthly_fee" inputMode="decimal" defaultValue={client?.monthly_fee ?? ""} className={input} placeholder="150,00" />
        </Field>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div>
          <h3 className="font-semibold">Supabase do cliente</h3>
          <p className="text-xs text-zinc-500">
            No projeto do cliente: Project Settings → API (ou API Keys). Use a <b>anon</b> ou <b>publishable</b> key. Nunca cole a
            service_role aqui.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project URL" hint="https://xxxx.supabase.co, ou só o ref do projeto">
            <input name="supabase_url" defaultValue={client?.supabase_url ?? ""} className={input} placeholder="https://abcd1234.supabase.co" />
          </Field>
          <Field label="Tabela consultada" hint="Padrão: keep_alive (crie com o SQL da página do cliente)">
            <input name="ping_table" defaultValue={client?.ping_table ?? "keep_alive"} className={input} />
          </Field>
        </div>
        <Field label="Anon / publishable key">
          <input name="supabase_key" defaultValue={client?.supabase_key ?? ""} className={`${input} font-mono text-xs`} placeholder="eyJhbGciOi… ou sb_publishable_…" />
        </Field>
      </section>

      <Field label="Observações">
        <textarea name="notes" rows={3} defaultValue={client?.notes ?? ""} className={input} placeholder="Domínio vence em março, login do registro.br…" />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={client?.active ?? true} className="size-4" />
        Cliente ativo (incluído no ping diário)
      </label>

      <SubmitButton pendingText="Salvando e testando…">{submitLabel}</SubmitButton>
    </form>
  );
}
