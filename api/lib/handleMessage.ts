import { createHash } from "crypto";
import { sanitizeText, validateMessage } from "../../src/lib/validation";
import { getStore } from "./store";
import { isRateLimited } from "./rateLimit";

export interface HandleResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Pure request handler: takes a raw client IP (for rate limiting only —
 * see the note below) and a parsed JSON body, returns an HTTP status and
 * JSON body. No framework types, so it can be called from any server
 * (Vercel, Netlify, Express, Workers, or the local dev server below).
 */
export async function handleMessagesRequest(rawIp: string, body: unknown): Promise<HandleResult> {
  // The IP is hashed and used only to key an in-memory rate-limit bucket
  // for a few minutes. It is never written to the message store or to
  // any persistent log kept by this handler.
  const rateLimitKey = createHash("sha256").update(rawIp).digest("hex");
  if (isRateLimited(rateLimitKey)) {
    return { status: 429, body: { error: "Troppe richieste. Riprova tra poco." } };
  }

  if (typeof body !== "object" || body === null) {
    return { status: 400, body: { error: "Richiesta non valida." } };
  }

  const { text, category } = body as Record<string, unknown>;

  if (typeof text !== "string" || (category !== undefined && typeof category !== "string")) {
    return { status: 400, body: { error: "Richiesta non valida." } };
  }

  const clean = sanitizeText(text);
  const validation = validateMessage({ text: clean, category: category as never });

  if (!validation.valid) {
    return { status: 400, body: { error: validation.error } };
  }

  try {
    const store = getStore();
    const saved = await store.save({ text: clean, category: category as string | undefined });
    return { status: 201, body: { id: saved.id, receivedAt: saved.createdAt } };
  } catch (err) {
    console.error("Errore nel salvataggio del messaggio:", err);
    return { status: 500, body: { error: "Qualcosa è andato storto. Riprova tra poco." } };
  }
}
