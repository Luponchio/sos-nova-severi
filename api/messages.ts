import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const MIN_LENGTH = 3;
const MAX_LENGTH = 3000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

const buckets = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_PER_WINDOW;
}

function sanitizeText(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo non consentito." });
  }

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  const rateLimitKey = createHash("sha256").update(ip).digest("hex");

  if (isRateLimited(rateLimitKey)) {
    return res.status(429).json({ error: "Troppe richieste. Riprova tra poco." });
  }

  const body = req.body ?? {};
  const rawText: unknown = body.text;
  const rawCategory: unknown = body.category;

  if (typeof rawText !== "string" || (rawCategory !== undefined && typeof rawCategory !== "string")) {
    return res.status(400).json({ error: "Richiesta non valida." });
  }

  const text = sanitizeText(rawText);

  if (text.length === 0) {
    return res.status(400).json({ error: "Scrivi qualcosa prima di inviare il messaggio." });
  }
  if (text.length < MIN_LENGTH) {
    return res.status(400).json({ error: "Il messaggio è troppo corto. Scrivi qualche parola in più." });
  }
  if (text.length > MAX_LENGTH) {
    return res.status(400).json({ error: `Il messaggio è troppo lungo (massimo ${MAX_LENGTH} caratteri).` });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("messages")
      .insert({ text, category: rawCategory ?? null })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ id: data.id, receivedAt: data.created_at });
  } catch (err) {
    console.error("Errore nel salvataggio del messaggio:", err);
    return res.status(500).json({ error: "Qualcosa è andato storto. Riprova tra poco." });
  }
}
