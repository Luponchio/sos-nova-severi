export const CATEGORIES = [
  { id: "proposta", label: "Proposta", emoji: "💡" },
  { id: "problema", label: "Problema", emoji: "⚠️" },
  { id: "scuola", label: "Scuola", emoji: "🏫" },
  { id: "trasporti", label: "Trasporti", emoji: "🚌" },
  { id: "didattica", label: "Didattica", emoji: "📚" },
  { id: "evento", label: "Evento / iniziativa", emoji: "🎯" },
  { id: "altro", label: "Altro", emoji: "💬" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const MESSAGE_MIN_LENGTH = 3;
export const MESSAGE_MAX_LENGTH = 3000;

export interface MessagePayload {
  text: string;
  category?: CategoryId;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Shared validation so the client and the API enforce the exact same rule.
 * Keep this file free of anything server-only (no db, no request objects)
 * so it can be imported from both src/ and api/.
 */
export function validateMessage(payload: Partial<MessagePayload>): ValidationResult {
  const text = (payload.text ?? "").trim();

  if (text.length === 0) {
    return { valid: false, error: "Scrivi qualcosa prima di inviare il messaggio." };
  }

  if (text.length < MESSAGE_MIN_LENGTH) {
    return { valid: false, error: "Il messaggio è troppo corto. Scrivi qualche parola in più." };
  }

  if (text.length > MESSAGE_MAX_LENGTH) {
    return {
      valid: false,
      error: `Il messaggio è troppo lungo (massimo ${MESSAGE_MAX_LENGTH} caratteri).`,
    };
  }

  if (payload.category && !CATEGORIES.some((c) => c.id === payload.category)) {
    return { valid: false, error: "Categoria non valida." };
  }

  return { valid: true };
}

/** Strips control characters and collapses excessive whitespace/newlines. */
export function sanitizeText(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}
