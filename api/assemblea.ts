/**
 * /api/assemblea — giochi dell'assemblea: "Accendi una stella" e "Indovina l'anno".
 *
 *   GET  /api/assemblea                       stato pubblico (schermo e telefoni)
 *   POST /api/assemblea  { tipo: "parola", parola, device }               dal telefono
 *   POST /api/assemblea  { tipo: "risposta", domanda, anno, codice, device } dal telefono
 *
 * Il codice anonimo del telefono si salva nella colonna "classe" di assemblea_risposte
 * (prima il quiz si giocava per classi): così non serve cambiare le tabelle.
 *   GET  /api/assemblea?r=regia               stato + parole da approvare   (x-admin-password)
 *   POST /api/assemblea?r=regia  { azione, ... }                            (x-admin-password)
 *
 * Il file è autonomo (nessun import relativo), come gli altri file di api/.
 * Le domande sono copiate in src/lib/assemblea.ts: se ne cambi una, cambiala in tutti e due.
 * Segreti solo lato server: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "crypto";

// ---------------------------------------------------------------------------
// Domande di "Indovina l'anno" (tenute allineate a src/lib/assemblea.ts)
// ---------------------------------------------------------------------------
const DOMANDE: { testo: string; anno: number }[] = [
  { testo: "Le donne italiane votano per la prima volta.", anno: 1946 },
  { testo: "Le donne possono diventare magistrate.", anno: 1963 },
  { testo: "Il marito smette di essere per legge il «capo della famiglia».", anno: 1975 },
  { testo: "Vengono cancellati il delitto d'onore e il matrimonio riparatore.", anno: 1981 },
  { testo: "Lo stupro diventa un reato contro la persona, non più contro la «morale pubblica».", anno: 1996 },
  { testo: "Nasce il 1522, il numero antiviolenza e antistalking.", anno: 2006 },
  { testo: "Lo stalking diventa reato.", anno: 2009 },
  { testo: "L'Italia ratifica la Convenzione di Istanbul contro la violenza sulle donne.", anno: 2013 },
  { testo: "Con il Codice Rosso il revenge porn diventa reato.", anno: 2019 },
  { testo: "Il femminicidio diventa un reato a sé nel Codice penale.", anno: 2025 },
];

/** Codice anonimo del telefono (niente 0/O e 1/I per non confondersi). */
const CODICE_RE = /^[A-HJ-NP-Z2-9]{4}$/;

/**
 * PIN di controllo per chi sale sul palco. Non viene salvato da nessuna parte:
 * si ricava dall'impronta del telefono, e il telefono lo ricalcola da solo
 * (src/lib/assemblea.ts, pinDelTelefono). Solo la regia e quel telefono lo vedono.
 */
function pinDa(deviceHash: string): string {
  return String(parseInt(sha256("pin:" + deviceHash).toString("hex").slice(0, 8), 16) % 10000).padStart(4, "0");
}
const DEVICE_RE = /^[0-9a-f-]{36}$/;
const FASI = ["attesa", "stella", "rumore", "quiz", "fine"] as const;
const STATI_QUIZ = ["pronta", "aperta", "chiusa", "risposta", "classifica"] as const;

/** Le 4 parole pronte dei telefoni: vanno sullo schermo senza approvazione. Copiate in src/lib/assemblea.ts. */
const PAROLE_PRONTE = ["Ascolto", "Fiducia", "Libertà", "Consenso"];

// Filtro grossolano: tutto passa comunque dalla regia prima di finire sullo schermo.
const PAROLACCE = [
  // Niente pezzi troppo corti: "fica" bloccherebbe "Significa", "cesso" "Successo".
  "cazz", "merd", "puttan", "stronz", "vaffan", "coglion", "frocio", "ricchion",
  "zoccol", "bastard", "minchi", "pompin", "fottut",
  // bestemmie, anche scritte attaccate o con lettere cambiate
  "porcod", "porkod", "diocan", "diokan", "dioporc", "diomaial", "diobestia", "porcamadonn",
  "madonnaputt", "madonnatroi", "porcogiuda",
];

interface Stato {
  fase: (typeof FASI)[number];
  stellaAperta: boolean;
  obiettivo: number;
  accendiTutto: boolean;
  domanda: number;
  statoQuiz: (typeof STATI_QUIZ)[number];
  versione: number;
  /** Cambia a ogni "azzera": i telefoni dimenticano cosa avevano già mandato. */
  giro: number;
}

const STATO_INIZIALE: Stato = {
  fase: "attesa",
  stellaAperta: false,
  obiettivo: 40,
  accendiTutto: false,
  domanda: 0,
  statoQuiz: "pronta",
  versione: 0,
  giro: 0,
};

const sha256 = (s: string) => createHash("sha256").update(s).digest();

// Generoso: in sala tanti telefoni escono con lo stesso IP.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 600;
const buckets = new Map<string, { count: number; windowStart: number }>();
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

function db() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function isAdmin(req: VercelRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  const given = req.headers["x-admin-password"];
  return !!expected && typeof given === "string" && timingSafeEqual(sha256(given), sha256(expected));
}

function body(req: VercelRequest): Record<string, unknown> {
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  return (b ?? {}) as Record<string, unknown>;
}

function punti(anno: number, giusto: number): number {
  return Math.max(0, Math.round(1000 - Math.abs(anno - giusto) * 25));
}

async function leggiStato(): Promise<Stato> {
  const { data, error } = await db().from("assemblea_stato").select("dati").eq("id", 1).maybeSingle();
  if (error) throw error;
  return { ...STATO_INIZIALE, ...((data?.dati as Partial<Stato>) ?? {}) };
}

async function salvaStato(stato: Stato) {
  const { error } = await db()
    .from("assemblea_stato")
    .upsert({ id: 1, dati: stato, aggiornato: new Date().toISOString() });
  if (error) throw error;
}

/** Tutto quello che schermo e telefoni devono sapere. Le risposte giuste escono solo dopo "Rivela". */
async function calcola(stato: Stato) {
  const client = db();
  const { data: parole, error: e1 } = await client
    .from("assemblea_parole")
    .select("id, parola")
    .eq("stato", "ok")
    .order("created_at", { ascending: true })
    .limit(300);
  if (e1) throw e1;

  const d = DOMANDE[stato.domanda] ?? DOMANDE[0];
  const { data: risposte, error: e2 } = await client
    .from("assemblea_risposte")
    .select("domanda, anno, classe, device_hash, created_at")
    .lte("domanda", stato.domanda)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (e2) throw e2;

  const qui = (risposte ?? []).filter((r) => r.domanda === stato.domanda);
  const rivelata = stato.statoQuiz === "risposta" || stato.statoQuiz === "classifica";

  // Classifica dei singoli: si somma per telefono (device_hash), non per codice,
  // così nessuno può "prendere in prestito" i punti di un altro scrivendo il suo codice.
  const perTelefono = new Map<string, { codice: string; pin: string; punti: number; risposte: number; ultima: string }>();
  for (const r of risposte ?? []) {
    const giusto = DOMANDE[r.domanda]?.anno;
    if (giusto === undefined) continue;
    const t = perTelefono.get(r.device_hash) ?? { codice: r.classe, pin: pinDa(r.device_hash), punti: 0, risposte: 0, ultima: "" };
    t.punti += punti(r.anno, giusto);
    t.risposte += 1;
    t.ultima = r.created_at;
    perTelefono.set(r.device_hash, t);
  }
  // a pari punti vince chi ha finito di rispondere prima
  const podio = [...perTelefono.values()]
    .sort((a, b) => b.punti - a.punti || a.ultima.localeCompare(b.ultima))
    .slice(0, 10);

  const vicino = rivelata && qui.length
    ? qui.reduce((m, r) => (Math.abs(r.anno - d.anno) < Math.abs(m.anno - d.anno) ? r : m))
    : undefined;

  const pubblico = {
    fase: stato.fase,
    versione: stato.versione,
    giro: stato.giro,
    stella: {
      aperta: stato.stellaAperta,
      obiettivo: stato.obiettivo,
      accendiTutto: stato.accendiTutto,
      parole: parole ?? [],
    },
    quiz: {
      domanda: stato.domanda,
      totale: DOMANDE.length,
      testo: d.testo,
      stato: stato.statoQuiz,
      risposte: qui.length,
      anno: rivelata ? d.anno : undefined,
      tentativi: rivelata ? qui.map((r) => r.anno).slice(0, 400) : undefined,
      migliore: vicino?.classe ?? undefined,
      // il PIN non esce mai qui: lo vedono solo la regia e il telefono che ha vinto
      classifica: stato.statoQuiz === "classifica"
        ? podio.map(({ codice, punti, risposte }) => ({ codice, punti, risposte }))
        : undefined,
    },
  };
  return { pubblico, podio };
}

async function gestisciRegia(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req)) return res.status(401).json({ error: "Password sbagliata." });
  const client = db();

  if (req.method === "GET") {
    const stato = await leggiStato();
    const { data: attesa, error } = await client
      .from("assemblea_parole")
      .select("id, parola")
      .eq("stato", "attesa")
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw error;
    const { pubblico, podio } = await calcola(stato);
    return res.status(200).json({ ...pubblico, attesa: attesa ?? [], domande: DOMANDE, podio });
  }

  const b = body(req);
  const azione = b.azione;

  if (azione === "stato") {
    const p = (b.patch ?? {}) as Partial<Stato>;
    const s = await leggiStato();
    if (p.fase !== undefined && (FASI as readonly string[]).includes(p.fase)) s.fase = p.fase;
    if (typeof p.stellaAperta === "boolean") s.stellaAperta = p.stellaAperta;
    if (typeof p.accendiTutto === "boolean") s.accendiTutto = p.accendiTutto;
    if (typeof p.obiettivo === "number" && p.obiettivo >= 5 && p.obiettivo <= 500) s.obiettivo = Math.round(p.obiettivo);
    if (typeof p.domanda === "number" && p.domanda >= 0 && p.domanda < DOMANDE.length) s.domanda = Math.round(p.domanda);
    if (p.statoQuiz !== undefined && (STATI_QUIZ as readonly string[]).includes(p.statoQuiz)) s.statoQuiz = p.statoQuiz;
    s.versione += 1;
    await salvaStato(s);
    return res.status(200).json({ ok: true });
  }

  if (azione === "parola") {
    const { id, ok } = b;
    if (typeof id !== "string" || !DEVICE_RE.test(id) || typeof ok !== "boolean") {
      return res.status(400).json({ error: "Richiesta non valida." });
    }
    const { error } = await client.from("assemblea_parole").update({ stato: ok ? "ok" : "no" }).eq("id", id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  if (azione === "aggiungi") {
    const parola = pulisci(b.parola);
    if (!parola) return res.status(400).json({ error: "Scrivi una parola (massimo 24 lettere)." });
    const { error } = await client.from("assemblea_parole").insert({ parola, stato: "ok" });
    if (error) throw error;
    return res.status(201).json({ ok: true });
  }

  if (azione === "azzera") {
    const cosa = b.cosa;
    if (cosa === "parole" || cosa === "tutto") {
      const { error } = await client.from("assemblea_parole").delete().not("id", "is", null);
      if (error) throw error;
    }
    if (cosa === "risposte" || cosa === "tutto") {
      const { error } = await client.from("assemblea_risposte").delete().not("id", "is", null);
      if (error) throw error;
    }
    const prima = await leggiStato();
    const giro = prima.giro + 1;
    await salvaStato(
      cosa === "tutto"
        ? { ...STATO_INIZIALE, versione: prima.versione + 1, giro }
        : { ...prima, versione: prima.versione + 1, giro }
    );
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Azione sconosciuta." });
}

function pulisci(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const p = v.normalize("NFC").replace(/\s+/g, " ").trim();
  if (p.length < 1 || p.length > 24) return null;
  if (!/^[\p{L}' -]+$/u.test(p)) return null;
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.query.r === "regia") return await gestisciRegia(req, res);

    if (req.method === "GET") {
      return res.status(200).json((await calcola(await leggiStato())).pubblico);
    }

    if (req.method === "POST") {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "unknown";
      if (limited(sha256(ip).toString("hex"))) {
        return res.status(429).json({ error: "Troppe richieste. Riprova tra poco." });
      }
      const b = body(req);
      const device = b.device;
      if (typeof device !== "string" || !DEVICE_RE.test(device)) {
        return res.status(400).json({ error: "Richiesta non valida." });
      }
      const stato = await leggiStato();

      if (b.tipo === "parola") {
        if (stato.fase !== "stella" || !stato.stellaAperta) {
          return res.status(409).json({ error: "In questo momento non si mandano parole." });
        }
        const parola = pulisci(b.parola);
        if (!parola) return res.status(400).json({ error: "Una parola sola, solo lettere (massimo 24)." });
        const bassa = parola.toLowerCase().replace(/[^a-zà-ù]/g, "");
        if (PAROLACCE.some((w) => bassa.includes(w))) {
          // non la salviamo nemmeno: chi l'ha scritta può mandarne un'altra
          return res.status(400).json({ error: "Questa parola non si può usare. Scrivine un'altra." });
        }
        const { error } = await db().from("assemblea_parole").insert({
          parola,
          stato: PAROLE_PRONTE.includes(parola) ? "ok" : "attesa",
          device_hash: sha256("parola:" + device).toString("hex"),
        });
        if (error) {
          if ((error as { code?: string }).code === "23505") {
            return res.status(409).json({ error: "Hai già mandato la tua parola." });
          }
          throw error;
        }
        return res.status(201).json({ ok: true });
      }

      if (b.tipo === "risposta") {
        const { domanda, anno, codice } = b;
        if (stato.fase !== "quiz" || stato.statoQuiz !== "aperta" || domanda !== stato.domanda) {
          return res.status(409).json({ error: "Le risposte per questa domanda sono chiuse." });
        }
        if (typeof anno !== "number" || !Number.isInteger(anno) || anno < 1800 || anno > 2100 ||
            typeof codice !== "string" || !CODICE_RE.test(codice)) {
          return res.status(400).json({ error: "Risposta non valida." });
        }
        const { error } = await db().from("assemblea_risposte").insert({
          domanda,
          anno,
          classe: codice,
          device_hash: sha256("quiz:" + device).toString("hex"),
        });
        if (error) {
          if ((error as { code?: string }).code === "23505") {
            return res.status(409).json({ error: "Hai già risposto a questa domanda." });
          }
          throw error;
        }
        return res.status(201).json({ ok: true });
      }

      return res.status(400).json({ error: "Richiesta non valida." });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Metodo non consentito." });
  } catch (err) {
    console.error("Errore assemblea:", err);
    return res.status(500).json({ error: "Qualcosa è andato storto. Riprova tra poco." });
  }
}
