import { CategoryId, MessagePayload, sanitizeText, validateMessage } from "./validation";

const COOLDOWN_KEY = "sos-nova-severi:last-submit";
const COOLDOWN_MS = 30_000; // 30s between submissions from the same device

export type SubmitOutcome =
  | { ok: true }
  | { ok: false; reason: "validation"; message: string }
  | { ok: false; reason: "cooldown"; message: string }
  | { ok: false; reason: "network"; message: string };

function msSinceLastSubmit(): number {
  const raw = localStorage.getItem(COOLDOWN_KEY);
  if (!raw) return Infinity;
  const last = Number(raw);
  if (Number.isNaN(last)) return Infinity;
  return Date.now() - last;
}

/**
 * Sends a message to the backend. Never sends anything beyond the message
 * text, an optional category, and a client-generated timestamp — no name,
 * no email, no class, no device identifiers.
 */
export async function submitMessage(text: string, category?: CategoryId): Promise<SubmitOutcome> {
  const clean = sanitizeText(text);
  const payload: MessagePayload = { text: clean, category };

  const validation = validateMessage(payload);
  if (!validation.valid) {
    return { ok: false, reason: "validation", message: validation.error! };
  }

  const elapsed = msSinceLastSubmit();
  if (elapsed < COOLDOWN_MS) {
    const waitSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    return {
      ok: false,
      reason: "cooldown",
      message: `Hai appena inviato un messaggio. Riprova tra ${waitSeconds}s.`,
    };
  }

  try {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: clean,
        category,
        clientTimestamp: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      return {
        ok: false,
        reason: "network",
        message: "Qualcosa è andato storto. Riprova tra poco.",
      };
    }

    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: "network",
      message: "Qualcosa è andato storto. Riprova tra poco.",
    };
  }
}
