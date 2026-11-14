import type { Client } from "./types";

/** O Supabase pausa projetos free após 7 dias sem atividade. */
export const PAUSE_AFTER_DAYS = 7;

export type Health = "ok" | "alerta" | "critico" | "sem-config" | "inativo";

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

export function clientHealth(c: Client): Health {
  if (!c.active) return "inativo";
  if (!c.supabase_url || !c.supabase_key) return "sem-config";
  const d = daysSince(c.last_ok_at);
  if (d === null) return c.last_ping_at ? "critico" : "alerta";
  if (d >= 5) return "critico";
  if (c.last_ping_ok === false || d >= 2) return "alerta";
  return "ok";
}

export const healthLabel: Record<Health, string> = {
  ok: "Saudável",
  alerta: "Atenção",
  critico: "Risco de pausa",
  "sem-config": "Sem Supabase",
  inativo: "Inativo",
};

export const healthClass: Record<Health, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30",
  alerta: "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30",
  critico: "bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/30",
  "sem-config": "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 ring-zinc-500/30",
  inativo: "bg-zinc-500/10 text-zinc-500 ring-zinc-500/20",
};

export function relTime(iso: string | null): string {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export function fmtMoney(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
