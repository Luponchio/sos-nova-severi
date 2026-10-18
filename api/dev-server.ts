/**
 * Minimal local dev server for the API, no framework dependency.
 * Run with: npm run dev:api
 * The Vite dev server (npm run dev) proxies /api to this on port 8787
 * (see vite.config.ts).
 *
 * This file is NOT used in production — Vercel calls api/messages.ts and
 * api/hub.ts directly. This is purely so `npm run dev` works end-to-end locally.
 * Without SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, /api/hub keeps its data in
 * memory (lost on restart).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { handleMessagesRequest } from "./lib/handleMessage";
import hub from "./hub";

const PORT = 8787;

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Wraps Node's req/res in the small subset of VercelRequest/Response that hub.ts uses. */
async function runHub(req: IncomingMessage, res: ServerResponse, url: URL) {
  const raw = await readBody(req);
  const type = String(req.headers["content-type"] ?? "");
  let parsed: unknown = raw;
  if (type.includes("application/json")) {
    try {
      parsed = raw.length ? JSON.parse(raw.toString("utf8")) : {};
    } catch {
      parsed = undefined;
    }
  }
  const vreq = Object.assign(req, {
    query: Object.fromEntries(url.searchParams),
    body: parsed,
    cookies: {},
  });
  let statusCode = 200;
  const vres = Object.assign(res, {
    status(code: number) {
      statusCode = code;
      return vres;
    },
    json(data: unknown) {
      res.writeHead(statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
      return vres;
    },
    send(data: Buffer | string) {
      res.statusCode = statusCode;
      res.end(data);
      return vres;
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await hub(vreq as any, vres as any);
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password, x-upsert, cache-control");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/api/hub") {
    return runHub(req, res, url);
  }

  if (url.pathname !== "/api/messages" || req.method !== "POST") {
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
