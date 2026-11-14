import type { Client, Ping } from "./types";

/** Sem Supabase configurado, o painel roda com dados fictícios só para visualização. */
export const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

function client(p: Partial<Client> & Pick<Client, "id" | "name">): Client {
  return {
    contact: null,
    site_url: null,
    supabase_url: `https://${p.id}abcd.supabase.co`,
    supabase_key: "eyJdemo",
    ping_table: "keep_alive",
    monthly_fee: null,
    notes: null,
    active: true,
    last_ping_at: ago(0.2),
    last_ok_at: ago(0.2),
    last_ping_ok: true,
    last_ping_message: null,
    last_site_ok: true,
    last_site_status: 200,
    created_at: ago(120),
    ...p,
  };
}

export const demoClients: Client[] = [
  client({ id: "padaria", name: "Padaria do João", contact: "(11) 98888-1234", site_url: "https://padariadojoao.com.br", monthly_fee: 150, notes: "Domínio vence em março." }),
  client({ id: "clinica", name: "Clínica Sorriso", contact: "contato@clinicasorriso.com", site_url: "https://clinicasorriso.com.br", monthly_fee: 290 }),
  client({ id: "academia", name: "Academia Força Total", site_url: "https://forcatotal.fit", monthly_fee: 200, last_ok_at: ago(3.4), last_ping_at: ago(0.2), last_ping_ok: false, last_ping_message: 'A tabela "keep_alive" não existe. Rode o keep_alive_cliente.sql nesse projeto.' }),
  client({ id: "petshop", name: "Pet Shop Amigo Fiel", contact: "(21) 97777-0000", site_url: "https://amigofiel.pet", monthly_fee: 180, last_ok_at: ago(6.1), last_ping_at: ago(0.2), last_ping_ok: false, last_ping_message: "Projeto PAUSADO ou indisponível (HTTP 540). Restaure no dashboard do Supabase.", last_site_ok: false, last_site_status: 503 }),
  client({ id: "advocacia", name: "Mendes Advocacia", site_url: "https://mendesadv.com.br", monthly_fee: 350 }),
  client({ id: "loja", name: "Loja da Ana (antigo)", active: false, monthly_fee: 120, last_ok_at: ago(40), last_ping_at: ago(40) }),
  client({ id: "portfolio", name: "Portfólio Fotógrafo Léo", site_url: "https://leofotos.com", supabase_url: null, supabase_key: null, last_ok_at: null, last_ping_ok: null }),
];

export function demoPings(clientId: string): Ping[] {
  const c = demoClients.find((x) => x.id === clientId);
  if (!c) return [];
  return Array.from({ length: 12 }, (_, i) => {
    const ok = c.last_ping_ok !== false || i > 2;
    return {
      id: i,
      client_id: clientId,
      created_at: ago(i + 0.2),
      source: i === 0 ? "manual" : "cron",
      db_ok: ok,
      db_status: ok ? 200 : 540,
      db_ms: 120 + ((i * 37) % 200),
      db_message: ok ? null : c.last_ping_message,
      site_ok: c.site_url ? true : null,
      site_status: c.site_url ? 200 : null,
      site_ms: c.site_url ? 300 + ((i * 53) % 400) : null,
    };
  });
}
