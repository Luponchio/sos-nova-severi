import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleMessagesRequest } from "./lib/handleMessage";

/**
 * POST /api/messages
 *
 * Accepts ONLY:
 *   - text: string (required)
 *   - category: string (optional, one of validation.ts CATEGORIES)
 *
 * Never accepts or stores name, email, class, phone number, or an account
 * identifier — none of those fields exist in the request shape.
 *
 * This file targets Vercel's Node serverless runtime. If you deploy
 * elsewhere, the actual logic lives in api/lib/handleMessage.ts, which has
 * no framework dependency — only this thin adapter needs to change.
 * See README.md → "Deploy".
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo non consentito." });
  }

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  const result = await handleMessagesRequest(ip, req.body ?? {});
  return res.status(result.status).json(result.body);
}
