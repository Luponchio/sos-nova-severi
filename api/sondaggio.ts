/**
 * /api/sondaggio — sondaggio "Più ricreazione" del sito di presentazione Nova Severi.
 *
 *   POST /api/sondaggio            { scelta: "cortile" | "minuti", device: "<uuid>" }  → registra un voto
 *   GET  /api/sondaggio?r=risultati  header x-admin-password                           → totali (solo admin)
 *
 * Un voto per dispositivo: il browser genera un codice casuale e lo manda col voto;
 * qui ne salviamo solo l'hash, e la colonna è unica. Nessun dato personale.
 * Il file è autonomo (nessun import relativo), come messages.ts e hub.ts.
 * Segreti solo lato server: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "crypto";

const SCELTE = ["cortile", "minuti"] as const;
const DEVICE_RE = /^[0-9a-f-]{36}$/;
const WINDOW_MS = 60_000;
// Generoso: a scuola e sui dati mobili tanti telefoni escono con lo stesso IP.
const MAX_PER_WINDOW = 120;
const buckets = new Map<string, { count: number; windowStart: number }>();

const sha256 = (s: string) => createHash("sha256").update(s).digest();

function limited(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  b.count += 1;
  return b.count > MAX_PER_WINDOW;
}

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");
  res.setHeader("Cache-Control", "no-store");
}

function db() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET" && req.query.r === "risultati") {
      const expected = process.env.ADMIN_PASSWORD;
      const given = req.headers["x-admin-password"];
      if (!expected || typeof given !== "string" || !timingSafeEqual(sha256(given), sha256(expected))) {
        return res.status(401).json({ error: "Password sbagliata." });
      }
      const client = db();
      const totali: Record<string, number> = {};
      for (const s of SCELTE) {
        const { count, error } = await client
          .from("ricreazione_voti")
          .select("id", { count: "exact", head: true })
          .eq("scelta", s);
        if (error) throw error;
        totali[s] = count ?? 0;
      }
      return res.status(200).json({ totali, totale: totali.cortile + totali.minuti });
    }

    if (req.method === "POST") {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "unknown";
      if (limited(sha256(ip).toString("hex"))) {
        return res.status(429).json({ error: "Troppe richieste. Riprova tra poco." });
      }
      const body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) ?? {};
      const { scelta, device } = body as Record<string, unknown>;
      if (typeof scelta !== "string" || !(SCELTE as readonly string[]).includes(scelta) ||
          typeof device !== "string" || !DEVICE_RE.test(device)) {
        return res.status(400).json({ error: "Voto non valido." });
      }
      const device_hash = sha256("ricreazione:" + device).toString("hex");
      const { error } = await db().from("ricreazione_voti").insert({ scelta, device_hash });
      if (error) {
        // 23505 = questo dispositivo ha già votato
        if ((error as { code?: string }).code === "23505") {
          return res.status(409).json({ error: "Hai già votato da questo telefono." });
        }
        throw error;
      }
      return res.status(201).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ error: "Metodo non consentito." });
  } catch (err) {
    console.error("Errore sondaggio:", err);
    return res.status(500).json({ error: "Qualcosa è andato storto. Riprova tra poco." });
  }
}
