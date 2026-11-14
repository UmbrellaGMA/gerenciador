import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "./types";

const TIMEOUT_MS = 15_000;

type Timed = { ok: boolean; status: number | null; ms: number; message: string | null };

async function timedFetch(url: string, init: RequestInit = {}): Promise<{ res: Response | null; ms: number; error: string | null }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { ...init, cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
    return { res, ms: Date.now() - start, error: null };
  } catch (e) {
    const err = e as Error;
    const msg = err.name === "TimeoutError" ? `Timeout (${TIMEOUT_MS / 1000}s)` : err.message;
    return { res: null, ms: Date.now() - start, error: msg };
  }
}

/**
 * Faz uma consulta REAL no Postgres do cliente (select na tabela keep_alive).
 * Requisições que não chegam no banco não impedem a pausa, então consultamos uma tabela.
 */
export async function pingDatabase(client: Pick<Client, "supabase_url" | "supabase_key" | "ping_table">): Promise<Timed> {
  if (!client.supabase_url || !client.supabase_key) {
    return { ok: false, status: null, ms: 0, message: "URL ou chave do Supabase não cadastrada" };
  }
  const base = client.supabase_url.replace(/\/+$/, "");
  const table = (client.ping_table || "keep_alive").trim();
  const key = client.supabase_key.trim();
  const headers: Record<string, string> = { apikey: key, Accept: "application/json" };
  // Chaves antigas (anon) são JWT e também vão no Authorization. Chaves novas (sb_publishable_) não.
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;

  const { res, ms, error } = await timedFetch(`${base}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`, { headers });
  if (!res) return { ok: false, status: null, ms, message: `Sem resposta: ${error}. O projeto pode estar pausado ou a URL está errada.` };

  if (res.ok) return { ok: true, status: res.status, ms, message: null };

  let detail = "";
  try {
    const body = await res.json();
    detail = body?.message || body?.hint || JSON.stringify(body);
  } catch {
    /* corpo não é JSON */
  }
  let message = `HTTP ${res.status}${detail ? `: ${detail}` : ""}`;
  if (res.status === 404 || /PGRST205|does not exist|Could not find the table/i.test(detail))
    message = `A tabela "${table}" não existe. Rode o keep_alive_cliente.sql nesse projeto.`;
  else if (res.status === 401 || res.status === 403) message = `Chave recusada (HTTP ${res.status}). Confira a anon/publishable key.`;
  else if (res.status === 540 || res.status === 503) message = `Projeto PAUSADO ou indisponível (HTTP ${res.status}). Restaure no dashboard do Supabase.`;
  return { ok: false, status: res.status, ms, message };
}

export async function pingSite(siteUrl: string | null): Promise<Timed | null> {
  if (!siteUrl) return null;
  const url = /^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`;
  const { res, ms, error } = await timedFetch(url, { headers: { "User-Agent": "PainelClientes-Monitor/1.0" } });
  if (!res) return { ok: false, status: null, ms, message: error };
  return { ok: res.status < 400, status: res.status, ms, message: null };
}

/** Pinga banco + site de um cliente e grava o resultado no banco do painel. */
export async function runPing(panel: SupabaseClient, client: Client, source: "cron" | "manual") {
  const [db, site] = await Promise.all([pingDatabase(client), pingSite(client.site_url)]);
  const now = new Date().toISOString();

  await panel.from("pings").insert({
    client_id: client.id,
    source,
    db_ok: db.ok,
    db_status: db.status,
    db_ms: db.ms,
    db_message: db.message,
    site_ok: site?.ok ?? null,
    site_status: site?.status ?? null,
    site_ms: site?.ms ?? null,
  });

  await panel
    .from("clients")
    .update({
      last_ping_at: now,
      last_ping_ok: db.ok,
      last_ping_message: db.message,
      ...(db.ok ? { last_ok_at: now } : {}),
      last_site_ok: site?.ok ?? null,
      last_site_status: site?.status ?? null,
    })
    .eq("id", client.id);

  return { db, site };
}
