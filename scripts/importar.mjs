#!/usr/bin/env node
/**
 * Importa automaticamente os projetos Supabase de VÁRIAS contas para o painel.
 *
 * Para cada token (Personal Access Token) do arquivo tokens.local.txt:
 *   1. lista os projetos da conta
 *   2. cria a tabela keep_alive no projeto (supabase/keep_alive_cliente.sql)
 *   3. busca a publishable/anon key
 *   4. testa o acesso e cadastra (ou atualiza) o cliente no painel
 *
 * Uso:
 *   node scripts/importar.mjs                       → SIMULAÇÃO: só lista o que faria (não muda nada)
 *   node scripts/importar.mjs --aplicar             → executa de verdade
 *   node scripts/importar.mjs --aplicar --restaurar → também pede restore dos projetos pausados
 *   --ignorar ref1,ref2   pula esses projetos (ex: projetos seus que não são de cliente)
 *   --somente ref1,ref2   processa só esses projetos
 *
 * Os tokens NUNCA são impressos nem gravados no painel. Depois de importar, revogue-os em
 * https://supabase.com/dashboard/account/tokens. O painel só precisa das publishable/anon keys.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.supabase.com/v1";
const TOKENS_FILE = path.join(ROOT, "tokens.local.txt");
const ENV_FILE = path.join(ROOT, ".env.local");

// ---------- argumentos ----------
const args = process.argv.slice(2);
const APLICAR = args.includes("--aplicar");
const RESTAURAR = args.includes("--restaurar");
const listArg = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? new Set(args[i + 1].split(",").map((s) => s.trim()).filter(Boolean)) : null;
};
const IGNORAR = listArg("--ignorar") ?? new Set();
const SOMENTE = listArg("--somente");

// ---------- cores ----------
const c = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  d: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
};

// ---------- tokens ----------
if (!existsSync(TOKENS_FILE)) {
  console.log(`Crie o arquivo ${c.b("tokens.local.txt")} na raiz do projeto, um token por linha:

  # rótulo da conta = token   (o rótulo é opcional, só para você se achar)
  Minha conta     = sbp_xxxxxxxxxxxxxxxx
  Conta Padaria   = sbp_yyyyyyyyyyyyyyyy

Gere cada token logado na conta em: https://supabase.com/dashboard/account/tokens`);
  process.exit(1);
}

const accounts = readFileSync(TOKENS_FILE, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .map((l, i) => {
    const eq = l.lastIndexOf("=");
    const label = eq > 0 ? l.slice(0, eq).trim() : `Conta ${i + 1}`;
    const token = (eq > 0 ? l.slice(eq + 1) : l).trim();
    // Formato opcional do rótulo: "Nome do cliente - https://site.com"
    const m = label.match(/^(.*?)\s+-\s+(https?:\/\/\S+)$/);
    return { label, token, name: m ? m[1].trim() : label, site: m ? m[2].replace(/\/+$/, "") : null };
  })
  .filter((a) => a.token);

if (accounts.length === 0) {
  console.log(c.r("Nenhum token encontrado em tokens.local.txt"));
  process.exit(1);
}

// ---------- painel ----------
let panel = null;
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
const PANEL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const PANEL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (PANEL_URL && PANEL_KEY) {
  const h = { apikey: PANEL_KEY, "Content-Type": "application/json" };
  if (PANEL_KEY.startsWith("eyJ")) h.Authorization = `Bearer ${PANEL_KEY}`;
  panel = { url: PANEL_URL, headers: h };
} else if (APLICAR) {
  console.log(c.r("Para --aplicar, preencha NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local (Supabase do painel)."));
  process.exit(1);
}

const keepAliveSql = readFileSync(path.join(ROOT, "supabase", "keep_alive_cliente.sql"), "utf8");

// ---------- helpers ----------
async function mgmt(token, method, p, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API}${p}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* texto puro */
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${json?.message ?? text.slice(0, 200)}`);
    return json;
  }
  throw new Error("Limite de requisições (429) excedido");
}

async function panelReq(method, p, body) {
  const res = await fetch(`${panel.url}/rest/v1/${p}`, {
    method,
    headers: { ...panel.headers, Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Painel HTTP ${res.status}: ${json?.message ?? ""}`);
  return json;
}

function pickKey(keys) {
  // Prefere a publishable (formato novo); cai para a anon (legada)
  const pub = keys.find((k) => k.type === "publishable" && k.api_key && !k.api_key.includes("·"));
  if (pub) return pub.api_key;
  const anon = keys.find((k) => k.name === "anon" && k.api_key);
  return anon?.api_key ?? null;
}

async function testKeepAlive(url, key) {
  const headers = { apikey: key };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${url}/rest/v1/keep_alive?select=id&limit=1`, { headers, signal: AbortSignal.timeout(20_000) });
  return res.ok ? null : `HTTP ${res.status}`;
}

// ---------- execução ----------
console.log(c.b(`\n${APLICAR ? "IMPORTANDO" : "SIMULAÇÃO (nada será alterado — use --aplicar para executar)"}\n`));

const existing = new Map();
if (panel) {
  try {
    for (const row of await panelReq("GET", "clients?select=id,name,supabase_url")) existing.set(row.supabase_url, row);
  } catch (e) {
    console.log(c.y(`Aviso: não consegui ler o painel (${e.message}). Rodou o schema.sql?`));
    if (APLICAR) process.exit(1);
  }
}

const stats = { ok: 0, novo: 0, atualizado: 0, pausado: 0, erro: 0, pulado: 0 };
const problems = [];

// 1) Coleta os projetos de todas as contas
const found = new Map(); // ref -> { p, acc, siblings }
for (const acc of accounts) {
  let projects;
  try {
    projects = await mgmt(acc.token, "GET", "/projects");
  } catch (e) {
    console.log(c.r("▸ " + acc.label + ": token inválido ou sem acesso (" + e.message + ")"));
    problems.push(acc.label + ": token inválido");
    stats.erro++;
    continue;
  }
  for (const p of projects ?? []) {
    const ref = p.id ?? p.ref;
    const cand = { p, acc, siblings: projects.length };
    const prev = found.get(ref);
    // Projeto em várias contas: prefere a conta com site informado e um único projeto
    const score = (x) => (x.acc.site ? 2 : 0) + (x.siblings === 1 ? 1 : 0);
    if (!prev || score(cand) > score(prev)) found.set(ref, cand);
  }
}

// 2) Processa cada projeto (sem duplicados)
const panelRef = PANEL_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
for (const [ref, { p, acc, siblings }] of found) {
  const url = "https://" + ref + ".supabase.co";
  // Conta com um único projeto: usa o nome e o site do tokens.local.txt
  const name = siblings === 1 && acc.site ? acc.name : p.name;
  const site = siblings === 1 ? acc.site : null;
  const tag = "  " + name + " " + c.d("(" + ref + " · conta " + acc.name + ")");

  if (ref === panelRef || IGNORAR.has(ref) || (SOMENTE && !SOMENTE.has(ref))) {
    console.log(tag + " " + c.d(ref === panelRef ? "— é o banco do painel, pulado" : "— pulado"));
    stats.pulado++;
    continue;
  }

  const status = p.status ?? "?";
  const paused = /INACTIVE|PAUSED/i.test(status);
  const inPanel = existing.has(url);

  if (!APLICAR) {
    const st = paused ? c.y("PAUSADO (" + status + ")") : status === "ACTIVE_HEALTHY" ? c.g("ativo") : c.y(status);
    console.log(tag + " " + st + " " + c.d(inPanel ? "· já está no painel (será atualizado)" : "· será cadastrado") + (site ? c.d(" · " + site) : ""));
    if (paused) stats.pausado++;
    continue;
  }

  try {
    if (paused) {
      stats.pausado++;
      if (!RESTAURAR) {
        console.log(tag + " " + c.y("PAUSADO — pulei (rode com --restaurar ou restaure no dashboard)"));
        problems.push(name + " (" + ref + "): pausado");
        continue;
      }
      await mgmt(acc.token, "POST", "/projects/" + ref + "/restore");
      console.log(tag + " " + c.y("restore solicitado — leva alguns minutos. Rode o script de novo depois."));
      problems.push(name + " (" + ref + "): restaurando, rode de novo depois");
      continue;
    }

    await mgmt(acc.token, "POST", "/projects/" + ref + "/database/query", { query: keepAliveSql });
    const keys = await mgmt(acc.token, "GET", "/projects/" + ref + "/api-keys");
    const key = pickKey(keys ?? []);
    if (!key) throw new Error("não encontrei publishable/anon key");

    const testErr = await testKeepAlive(url, key);

    const row = { supabase_url: url, supabase_key: key, ping_table: "keep_alive" };
    if (inPanel) {
      await panelReq("PATCH", "clients?id=eq." + existing.get(url).id, row);
      stats.atualizado++;
    } else {
      const [created] = await panelReq("POST", "clients", { ...row, name, site_url: site, active: true, notes: "Importado da conta \"" + acc.name + "\"" });
      existing.set(url, created);
      stats.novo++;
    }
    stats.ok++;
    console.log(tag + " " + c.g("✓") + " " + (inPanel ? "atualizado" : "cadastrado") + (testErr ? c.y(" (teste do keep_alive: " + testErr + ")") : ""));
    if (testErr) problems.push(name + " (" + ref + "): teste do keep_alive deu " + testErr);
  } catch (e) {
    stats.erro++;
    console.log(tag + " " + c.r("✗ " + e.message));
    problems.push(name + " (" + ref + "): " + e.message);
  }
}

console.log(c.b("Resumo"));
if (APLICAR) console.log(`  cadastrados: ${stats.novo} · atualizados: ${stats.atualizado} · erros: ${stats.erro} · pausados: ${stats.pausado} · pulados: ${stats.pulado}`);
else console.log(`  contas: ${accounts.length} · pausados: ${stats.pausado} · pulados: ${stats.pulado}`);
if (problems.length) {
  console.log(c.y("\nAtenção:"));
  problems.forEach((p) => console.log(c.y(`  • ${p}`)));
}
if (APLICAR && stats.ok) {
  console.log(`\nPróximos passos:
  1. No painel, clique em "Pingar todos agora" para confirmar.
  2. Edite cada cliente para completar o site, o contato e a mensalidade.
  3. ${c.b("Revogue os tokens")} em https://supabase.com/dashboard/account/tokens (em cada conta).`);
}
