import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clientHealth, daysSince, fmtDate, fmtMoney, healthClass, healthLabel, relTime, PAUSE_AFTER_DAYS } from "@/lib/status";
import type { Client, Ping } from "@/lib/types";
import { deleteClientAction, pingNowAction, updateClientAction } from "../../actions";
import { ClientForm } from "@/components/ClientForm";
import { ConfirmDelete, CopyButton, SubmitButton } from "@/components/ui";

import { keepAliveSql } from "@/lib/keepAliveSql";
import { demoClients, demoPings, isDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { id } = await params;
  const { editar } = await searchParams;
  let client: Client | null;
  let history: Ping[];
  if (isDemo) {
    client = demoClients.find((x) => x.id === id) ?? null;
    history = demoPings(id);
  } else {
    const supabase = await createClient();
    const [cr, pr] = await Promise.all([
      supabase.from("clients").select("*").eq("id", id).maybeSingle(),
      supabase.from("pings").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(30),
    ]);
    client = cr.data as Client | null;
    history = (pr.data ?? []) as Ping[];
  }
  if (!client) notFound();
  const c = client;
  const health = clientHealth(c);
  const d = daysSince(c.last_ok_at);
  const projectRef = c.supabase_url?.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
  const needsTable = c.last_ping_ok === false && /não existe/.test(c.last_ping_message ?? "");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Voltar
      </Link>

      <header className="mb-6 mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{c.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${healthClass[health]}`}>{healthLabel[health]}</span>
            {c.contact && <span>{c.contact}</span>}
            {c.monthly_fee !== null && <span>· {fmtMoney(c.monthly_fee)}/mês</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={pingNowAction.bind(null, c.id)}>
            <SubmitButton pendingText="Pingando…">Pingar agora</SubmitButton>
          </form>
          <Link href={editar ? `/clientes/${c.id}` : `/clientes/${c.id}?editar=1`} className="rounded-lg px-3.5 py-2 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800">
            {editar ? "Cancelar edição" : "Editar"}
          </Link>
        </div>
      </header>

      {editar ? (
        <div className="space-y-10">
          <ClientForm action={updateClientAction.bind(null, c.id)} client={c} submitLabel="Salvar alterações" />
          <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <ConfirmDelete action={deleteClientAction.bind(null, c.id)} />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-3">
            <Info label="Última atividade no banco" value={relTime(c.last_ok_at)} sub={d !== null ? `Pausa em ~${Math.max(0, Math.ceil(PAUSE_AFTER_DAYS - d))} dia(s) se parar` : undefined} />
            <Info label="Último ping" value={relTime(c.last_ping_at)} sub={c.last_ping_ok === null ? undefined : c.last_ping_ok ? "Sucesso" : "Falhou"} />
            <Info
              label="Site"
              value={c.site_url ? (c.last_site_ok === null ? "Não verificado" : c.last_site_ok ? "No ar" : "Fora do ar") : "—"}
              sub={c.last_site_status ? `HTTP ${c.last_site_status}` : undefined}
            />
          </section>

          {c.last_ping_ok === false && c.last_ping_message && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              <b>Problema:</b> {c.last_ping_message}
            </div>
          )}

          <section className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2">
            <Row label="Site">
              {c.site_url ? (
                <a href={c.site_url.startsWith("http") ? c.site_url : `https://${c.site_url}`} target="_blank" className="underline">
                  {c.site_url}
                </a>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Supabase">
              {projectRef ? (
                <a href={`https://supabase.com/dashboard/project/${projectRef}`} target="_blank" className="underline">
                  Abrir dashboard ({projectRef})
                </a>
              ) : (
                c.supabase_url ?? "—"
              )}
            </Row>
            <Row label="Tabela consultada">{c.ping_table ?? "keep_alive"}</Row>
            <Row label="Cadastrado em">{fmtDate(c.created_at)}</Row>
            {c.notes && (
              <div className="sm:col-span-2">
                <div className="text-xs text-zinc-500">Observações</div>
                <p className="whitespace-pre-wrap">{c.notes}</p>
              </div>
            )}
          </section>

          <details open={needsTable} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <summary className="cursor-pointer text-sm font-medium">SQL para criar a tabela keep_alive no Supabase do cliente</summary>
            <p className="mt-2 text-xs text-zinc-500">
              Rode uma vez no SQL Editor do projeto do cliente
              {projectRef && (
                <>
                  {" "}(
                  <a className="underline" target="_blank" href={`https://supabase.com/dashboard/project/${projectRef}/sql/new`}>
                    abrir SQL Editor
                  </a>
                  )
                </>
              )}
              .
            </p>
            <div className="mt-3 flex justify-end">
              <CopyButton text={keepAliveSql} label="Copiar SQL" />
            </div>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-950">{keepAliveSql}</pre>
          </details>

          <section>
            <h2 className="mb-3 font-semibold">Histórico (últimos 30)</h2>
            {history.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum ping ainda.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-2 font-medium">Quando</th>
                      <th className="px-4 py-2 font-medium">Origem</th>
                      <th className="px-4 py-2 font-medium">Banco</th>
                      <th className="px-4 py-2 font-medium">Site</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {history.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                        <td className="px-4 py-2 text-zinc-500">{p.source === "cron" ? "automático" : "manual"}</td>
                        <td className="px-4 py-2">
                          <span className={p.db_ok ? "text-emerald-600" : "text-red-600"}>{p.db_ok ? "OK" : "Falhou"}</span>
                          <span className="text-zinc-500"> · {p.db_ms} ms</span>
                          {p.db_message && <div className="max-w-sm truncate text-xs text-zinc-500" title={p.db_message}>{p.db_message}</div>}
                        </td>
                        <td className="px-4 py-2">
                          {p.site_ok === null ? (
                            <span className="text-zinc-400">—</span>
                          ) : (
                            <>
                              <span className={p.site_ok ? "text-emerald-600" : "text-red-600"}>{p.site_status ?? "erro"}</span>
                              <span className="text-zinc-500"> · {p.site_ms} ms</span>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function Info({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="truncate">{children}</div>
    </div>
  );
}
