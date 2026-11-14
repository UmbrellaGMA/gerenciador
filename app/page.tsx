import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { clientHealth, daysSince, fmtMoney, healthClass, healthLabel, relTime, PAUSE_AFTER_DAYS, type Health } from "@/lib/status";
import type { Client } from "@/lib/types";
import { pingAllAction, pingNowAction, signOut } from "./actions";
import { SubmitButton } from "@/components/ui";
import { demoClients, isDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

const order: Record<Health, number> = { critico: 0, alerta: 1, "sem-config": 2, ok: 3, inativo: 4 };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  let all: Client[] = demoClients;
  let error: { message: string } | null = null;
  if (!isDemo) {
    const supabase = await createClient();
    const res = await supabase.from("clients").select("*").order("name");
    all = (res.data ?? []) as Client[];
    error = res.error;
  }

  const clients = all
    .filter((c) => !q || `${c.name} ${c.site_url ?? ""} ${c.contact ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .map((c) => ({ ...c, health: clientHealth(c) }))
    .sort((a, b) => order[a.health] - order[b.health] || a.name.localeCompare(b.name));

  const count = (h: Health) => all.filter((c) => clientHealth(c) === h).length;
  const revenue = all.filter((c) => c.active).reduce((s, c) => s + Number(c.monthly_fee ?? 0), 0);
  const sitesDown = all.filter((c) => c.active && c.last_site_ok === false).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel de Clientes</h1>
          <p className="text-sm text-zinc-500">
            Ping automático diário. O Supabase free pausa depois de {PAUSE_AFTER_DAYS} dias sem atividade.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={pingAllAction}>
            <SubmitButton variant="ghost" pendingText="Pingando todos…">
              Pingar todos agora
            </SubmitButton>
          </form>
          <Link href="/clientes/novo" className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
            + Novo cliente
          </Link>
          <form action={signOut}>
            <button className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">Sair</button>
          </form>
        </div>
      </header>

      {isDemo && (
        <div className="mb-6 rounded-lg border border-sky-300 bg-sky-50 p-4 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300">
          <b>Modo demonstração:</b> dados fictícios. Configure o <code>.env.local</code> com o Supabase do painel para usar de verdade.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Erro ao ler o banco do painel: {error.message}. Você rodou o <code>supabase/schema.sql</code>?
        </div>
      )}

      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Clientes ativos" value={all.filter((c) => c.active).length} />
        <Stat label="Saudáveis" value={count("ok")} tone="text-emerald-600" />
        <Stat label="Atenção / risco" value={count("alerta") + count("critico")} tone={count("critico") ? "text-red-600" : "text-amber-600"} />
        <Stat label="Sites fora do ar" value={sitesDown} tone={sitesDown ? "text-red-600" : undefined} />
        <Stat label="Receita mensal" value={fmtMoney(revenue)} />
      </section>

      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar cliente, site ou contato…"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:max-w-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </form>

      {clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="mb-4 text-zinc-500">{q ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</p>
          {!q && (
            <Link href="/clientes/novo" className="text-sm font-medium underline">
              Cadastrar o primeiro cliente
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Status Supabase</th>
                <th className="px-4 py-3 font-medium">Última atividade</th>
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 font-medium">Mensalidade</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {clients.map((c) => {
                const d = daysSince(c.last_ok_at);
                return (
                  <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3">
                      <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      {c.contact && <div className="text-xs text-zinc-500">{c.contact}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${healthClass[c.health]}`}>{healthLabel[c.health]}</span>
                      {c.last_ping_ok === false && c.last_ping_message && (
                        <div className="mt-1 max-w-xs truncate text-xs text-red-600" title={c.last_ping_message}>
                          {c.last_ping_message}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>{relTime(c.last_ok_at)}</div>
                      {d !== null && c.active && (
                        <div className="text-xs text-zinc-500">
                          pausa em ~{Math.max(0, Math.ceil(PAUSE_AFTER_DAYS - d))} dia(s) se parar
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.site_url ? (
                        <a href={c.site_url.startsWith("http") ? c.site_url : `https://${c.site_url}`} target="_blank" className="inline-flex items-center gap-1.5 hover:underline">
                          <span className={`size-2 rounded-full ${c.last_site_ok === null ? "bg-zinc-300" : c.last_site_ok ? "bg-emerald-500" : "bg-red-500"}`} />
                          <span className="max-w-[180px] truncate">{c.site_url.replace(/^https?:\/\//, "")}</span>
                        </a>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{fmtMoney(c.monthly_fee)}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={pingNowAction.bind(null, c.id)}>
                        <SubmitButton variant="ghost" pendingText="…" className="!px-2.5 !py-1 text-xs">
                          Pingar
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
