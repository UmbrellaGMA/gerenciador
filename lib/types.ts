export type Client = {
  id: string;
  name: string;
  contact: string | null;
  site_url: string | null;
  supabase_url: string | null;
  supabase_key: string | null;
  ping_table: string | null;
  monthly_fee: number | null;
  notes: string | null;
  active: boolean;
  last_ping_at: string | null;
  last_ok_at: string | null;
  last_ping_ok: boolean | null;
  last_ping_message: string | null;
  last_site_ok: boolean | null;
  last_site_status: number | null;
  created_at: string;
};

export type Ping = {
  id: number;
  client_id: string;
  created_at: string;
  source: "cron" | "manual";
  db_ok: boolean | null;
  db_status: number | null;
  db_ms: number | null;
  db_message: string | null;
  site_ok: boolean | null;
  site_status: number | null;
  site_ms: number | null;
};
