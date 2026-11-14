import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente com service_role: usado apenas pelo cron (ignora RLS). Nunca importe no browser. */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
