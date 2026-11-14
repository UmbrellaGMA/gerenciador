"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, isAllowedEmail } from "@/lib/supabase/server";
import { runPing } from "@/lib/ping";
import type { Client } from "@/lib/types";
import { isDemo } from "@/lib/demo";

async function requireUser() {
  if (isDemo) throw new Error("Modo demonstração: configure o .env.local com o Supabase do painel para salvar e pingar.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    redirect("/login");
  }
  return supabase;
}

function str(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v;
}

function parseClient(fd: FormData) {
  const fee = str(fd, "monthly_fee");
  let supabase_url = str(fd, "supabase_url");
  // Aceita colar só o "ref" do projeto (ex: abcd1234) ou a URL completa
  if (supabase_url && !supabase_url.startsWith("http")) supabase_url = `https://${supabase_url}.supabase.co`;
  return {
    name: str(fd, "name") ?? "Sem nome",
    contact: str(fd, "contact"),
    site_url: str(fd, "site_url"),
    supabase_url: supabase_url?.replace(/\/+$/, "") ?? null,
    supabase_key: str(fd, "supabase_key"),
    ping_table: str(fd, "ping_table") ?? "keep_alive",
    monthly_fee: fee ? Number(fee.replace(/\./g, "").replace(",", ".")) || null : null,
    notes: str(fd, "notes"),
    active: fd.get("active") === "on",
  };
}

export async function signIn(_: unknown, fd: FormData) {
  const supabase = await createClient();
  const email = String(fd.get("email") ?? "");
  if (!isAllowedEmail(email)) return { error: "E-mail não autorizado." };
  const { error } = await supabase.auth.signInWithPassword({ email, password: String(fd.get("password") ?? "") });
  if (error) return { error: "E-mail ou senha inválidos." };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createClientAction(fd: FormData) {
  const supabase = await requireUser();
  const { data, error } = await supabase.from("clients").insert(parseClient(fd)).select("*").single();
  if (error) throw new Error(error.message);
  // Já testa a conexão logo após cadastrar
  await runPing(supabase, data as Client, "manual");
  revalidatePath("/");
  redirect(`/clientes/${data.id}`);
}

export async function updateClientAction(id: string, fd: FormData) {
  const supabase = await requireUser();
  const { error } = await supabase.from("clients").update(parseClient(fd)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

export async function deleteClientAction(id: string) {
  const supabase = await requireUser();
  await supabase.from("clients").delete().eq("id", id);
  revalidatePath("/");
  redirect("/");
}

export async function pingNowAction(id: string) {
  const supabase = await requireUser();
  const { data } = await supabase.from("clients").select("*").eq("id", id).single();
  if (data) await runPing(supabase, data as Client, "manual");
  revalidatePath("/");
  revalidatePath(`/clientes/${id}`);
}

export async function pingAllAction() {
  const supabase = await requireUser();
  const { data } = await supabase.from("clients").select("*").eq("active", true);
  await Promise.allSettled(((data ?? []) as Client[]).map((c) => runPing(supabase, c, "manual")));
  revalidatePath("/");
}
