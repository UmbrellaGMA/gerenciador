import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPing } from "@/lib/ping";
import type { Client } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Chamado pela Vercel Cron 1x por dia (veja vercel.json).
 * Pinga todos os clientes ativos e, de quebra, gera atividade no próprio banco do painel.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const panel = createAdminClient();
  const { data: clients, error } = await panel.from("clients").select("*").eq("active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.allSettled((clients as Client[]).map((c) => runPing(panel, c, "cron")));

  await panel.rpc("prune_old_pings");

  const summary = (clients as Client[]).map((c, i) => {
    const r = results[i];
    return r.status === "fulfilled"
      ? { name: c.name, db_ok: r.value.db.ok, message: r.value.db.message, site_ok: r.value.site?.ok ?? null }
      : { name: c.name, db_ok: false, message: String(r.reason) };
  });

  return NextResponse.json({
    at: new Date().toISOString(),
    total: summary.length,
    failed: summary.filter((s) => !s.db_ok).length,
    summary,
  });
}
