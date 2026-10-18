/**
 * Ping giornaliero chiamato dal cron di Vercel (vedi vercel.json).
 * Fa una lettura minima sul database così il progetto Supabase gratuito
 * non viene messo in pausa per inattività (succede dopo 7 giorni senza attività).
 * Non restituisce dati: solo ok / errore.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ ok: false });

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.from("messages").select("id", { head: true, count: "exact" }).limit(1);

  if (error) {
    console.error("Keepalive: errore Supabase", error.message);
    return res.status(500).json({ ok: false });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: true });
}
