/**
 * Minimal local dev server for the API, no framework dependency.
 * Run with: npm run dev:api
 * The Vite dev server (npm run dev) proxies /api to this on port 8787
 * (see vite.config.ts).
 *
 * This file is NOT used in production — Vercel calls api/messages.ts
 * directly. This is purely so `npm run dev` works end-to-end locally.
 */
import { createServer } from "http";
import { handleMessagesRequest } from "./lib/handleMessage";

const PORT = 8787;

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.url !== "/api/messages" || req.method !== "POST") {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Not found" }));
  }

  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", async () => {
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "JSON non valido." }));
    }

    const ip = req.socket.remoteAddress || "unknown";
    const result = await handleMessagesRequest(ip, body);

    res.writeHead(result.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result.body));
  });
});

server.listen(PORT, () => {
  console.log(`API locale in ascolto su http://localhost:${PORT}`);
});
