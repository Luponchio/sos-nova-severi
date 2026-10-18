/**
 * /api/hub — un'unica funzione serverless per le sezioni Appunti, Libri usati
 * e Admin. Il parametro `r` sceglie la risorsa:
 *
 *   GET  /api/hub?r=notes                elenco appunti
 *   POST /api/hub?r=notes-upload         chiede un link firmato per caricare il file
 *   POST /api/hub?r=notes                salva i dati dell'appunto dopo il caricamento
 *   GET  /api/hub?r=books                elenco libri usati (senza numeri di telefono)
 *   POST /api/hub?r=books                nuovo annuncio, restituisce il codice di cancellazione
 *   GET  /api/hub?r=book-contact&id=...  numero di telefono di un annuncio (solo su richiesta)
 *   POST /api/hub?r=book-delete          il venditore cancella il suo annuncio con il codice
 *   POST /api/hub?r=admin                pannello admin (header x-admin-password)
 *
 * Il file è volutamente autonomo (nessun import relativo), come api/messages.ts:
 * con "type": "module" le funzioni Vercel non risolvono gli import tra file .ts.
 *
 * Segreti: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e ADMIN_PASSWORD vivono solo
 * nelle variabili d'ambiente del server. Il browser non li vede mai.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "crypto";

// ---------------------------------------------------------------------------
// Regole condivise (tenute allineate a src/lib/catalog.ts)
// ---------------------------------------------------------------------------

const SUBJECTS = [
  "Italiano",
  "Latino",
  "Matematica",
  "Fisica",
  "Scienze naturali",
  "Informatica",
  "Inglese",
  "Storia",
  "Geografia",
  "Storia e Geografia",
  "Filosofia",
  "Disegno e Storia dell'arte",
  "Scienze motorie",
  "Discipline sportive",
  "Diritto ed Economia dello sport",
  "Educazione civica",
  "Religione",
  "Altro",
] as const;

const BOOK_CONDITIONS = ["Come nuovo", "Buono", "Usato", "Con sottolineature"] as const;

const BUCKET = "appunti";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const FILE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const PATH_RE = /^\d{4}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/;
const UUID_RE = /^[0-9a-f-]{36}$/;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

interface NoteRow {
  id: string;
  title: string;
  subject: string;
  class_year: number;
  teacher: string | null;
  description: string | null;
  file_path: string;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
}

interface BookRow {
  id: string;
  title: string;
  author: string | null;
  subject: string | null;
  class_year: number | null;
  price: number;
  condition: string | null;
  phone: string | null;
  instagram: string | null;
  delete_code_hash: string;
  created_at: string;
}

interface MessageRow {
  id: string;
  text: string;
  category: string | null;
  created_at: string;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Accesso ai dati: Supabase in produzione, memoria solo in sviluppo locale
// ---------------------------------------------------------------------------

interface Db {
  listNotes(): Promise<NoteRow[]>;
  insertNote(row: Omit<NoteRow, "id" | "created_at">): Promise<NoteRow>;
  deleteNote(id: string): Promise<void>;
  createUploadUrl(path: string): Promise<string>;
  fileExists(path: string): Promise<boolean>;
  publicUrl(path: string): string;
  listBooks(): Promise<BookRow[]>;
  getBook(id: string): Promise<BookRow | null>;
  insertBook(row: Omit<BookRow, "id" | "created_at">): Promise<BookRow>;
  deleteBook(id: string): Promise<void>;
  listMessages(): Promise<MessageRow[]>;
}

class SupabaseDb implements Db {
  constructor(private sb: SupabaseClient) {}

  async listNotes() {
    const { data, error } = await this.sb
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return (data ?? []) as NoteRow[];
  }

  async insertNote(row: Omit<NoteRow, "id" | "created_at">) {
    const { data, error } = await this.sb.from("notes").insert(row).select().single();
    if (error) throw error;
    return data as NoteRow;
  }

  async deleteNote(id: string) {
    const { data, error } = await this.sb.from("notes").delete().eq("id", id).select("file_path");
    if (error) throw error;
    const paths = (data ?? []).map((r: { file_path: string }) => r.file_path);
    if (paths.length) await this.sb.storage.from(BUCKET).remove(paths);
  }

  async createUploadUrl(path: string) {
    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw error;
    return data.signedUrl;
  }

  async fileExists(path: string) {
    const [folder, name] = path.split("/");
    const { data, error } = await this.sb.storage.from(BUCKET).list(folder, { search: name, limit: 1 });
    if (error) throw error;
    return (data ?? []).some((f) => f.name === name);
  }

  publicUrl(path: string) {
    return this.sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async listBooks() {
    const { data, error } = await this.sb
      .from("books")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return (data ?? []) as BookRow[];
  }

  async getBook(id: string) {
    const { data, error } = await this.sb.from("books").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as BookRow | null) ?? null;
  }

  async insertBook(row: Omit<BookRow, "id" | "created_at">) {
    const { data, error } = await this.sb.from("books").insert(row).select().single();
    if (error) throw error;
    return data as BookRow;
  }

  async deleteBook(id: string) {
    const { error } = await this.sb.from("books").delete().eq("id", id);
    if (error) throw error;
  }

  async listMessages() {
    const { data, error } = await this.sb
      .from("messages")
      .select("id, text, category, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;
    return (data ?? []) as MessageRow[];
  }
}

/** Solo per `npm run dev` senza Supabase: i dati spariscono al riavvio. */
class MemoryDb implements Db {
  notes: NoteRow[] = [];
  books: BookRow[] = [];
  files = new Map<string, { type: string; body: Buffer }>();

  async listNotes() {
    return [...this.notes].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async insertNote(row: Omit<NoteRow, "id" | "created_at">) {
    const full = { ...row, id: randomUUID(), created_at: new Date().toISOString() };
    this.notes.push(full);
    return full;
  }
  async deleteNote(id: string) {
    const note = this.notes.find((n) => n.id === id);
    if (note) this.files.delete(note.file_path);
    this.notes = this.notes.filter((n) => n.id !== id);
  }
  async createUploadUrl(path: string) {
    return `/api/hub?r=dev-upload&path=${encodeURIComponent(path)}`;
  }
  async fileExists(path: string) {
    return this.files.has(path);
  }
  publicUrl(path: string) {
    return `/api/hub?r=dev-file&path=${encodeURIComponent(path)}`;
  }
  async listBooks() {
    return [...this.books].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async getBook(id: string) {
    return this.books.find((b) => b.id === id) ?? null;
  }
  async insertBook(row: Omit<BookRow, "id" | "created_at">) {
    const full = { ...row, id: randomUUID(), created_at: new Date().toISOString() };
    this.books.push(full);
    return full;
  }
  async deleteBook(id: string) {
    this.books = this.books.filter((b) => b.id !== id);
  }
  async listMessages() {
    return [];
  }
}

let db: Db | null = null;
let memoryDb: MemoryDb | null = null;

function getDb(): Db {
  if (db) return db;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    db = new SupabaseDb(createClient(url, key, { auth: { persistSession: false } }));
  } else if (!process.env.VERCEL) {
    memoryDb = new MemoryDb();
    db = memoryDb;
  } else {
    throw new HttpError(500, "Configurazione del server incompleta.");
  }
  return db;
}

// ---------------------------------------------------------------------------
// Utilità
// ---------------------------------------------------------------------------

const buckets = new Map<string, { count: number; start: number }>();

/** Limite anti-spam in memoria, per IP (hashato, mai salvato) e per gruppo. */
function limit(req: VercelRequest, group: string, max: number, windowMs = 60_000) {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  const key = group + ":" + createHash("sha256").update(ip).digest("hex");
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    buckets.set(key, { count: 1, start: now });
    return;
  }
  b.count += 1;
  if (b.count > max) throw new HttpError(429, "Troppe richieste. Riprova tra un minuto.");
}

function clean(input: unknown, max: number, field: string, required = true): string | null {
  if (input === undefined || input === null || input === "") {
    if (required) throw new HttpError(400, `Compila il campo ${field}.`);
    return null;
  }
  if (typeof input !== "string") throw new HttpError(400, "Richiesta non valida.");
  const text = input
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!text) {
    if (required) throw new HttpError(400, `Compila il campo ${field}.`);
    return null;
  }
  if (text.length > max) throw new HttpError(400, `Il campo ${field} è troppo lungo (massimo ${max} caratteri).`);
  return text;
}

function classYear(input: unknown, required: boolean): number | null {
  if ((input === undefined || input === null || input === "") && !required) return null;
  const n = Number(input);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new HttpError(400, "Scegli una classe dalla 1ª alla 5ª.");
  return n;
}

function subject(input: unknown, required: boolean): string | null {
  if ((input === undefined || input === null || input === "") && !required) return null;
  if (typeof input !== "string" || !(SUBJECTS as readonly string[]).includes(input)) {
    throw new HttpError(400, "Scegli una materia dall'elenco.");
  }
  return input;
}

/** Cellulare italiano: 3xx..., con o senza +39. Restituisce il formato +39... */
function phone(input: unknown): string | null {
  if (input === undefined || input === null || input === "") return null;
  if (typeof input !== "string") throw new HttpError(400, "Richiesta non valida.");
  let p = input.replace(/[\s.\-/()]/g, "");
  if (p.startsWith("0039")) p = "+39" + p.slice(4);
  if (!p.startsWith("+39")) p = "+39" + p;
  if (!/^\+393\d{8,9}$/.test(p)) throw new HttpError(400, "Il numero di cellulare non sembra valido.");
  return p;
}

function instagram(input: unknown): string | null {
  if (input === undefined || input === null || input === "") return null;
  if (typeof input !== "string") throw new HttpError(400, "Richiesta non valida.");
  let h = input.trim();
  const fromUrl = h.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (fromUrl) h = fromUrl[1];
  h = h.replace(/^@/, "");
  if (!h) return null;
  if (!/^[A-Za-z0-9._]{1,30}$/.test(h)) throw new HttpError(400, "Il nome Instagram non sembra valido.");
  return h.toLowerCase();
}

function sha256(text: string) {
  return createHash("sha256").update(text).digest();
}

function sameSecret(a: string, b: string) {
  return timingSafeEqual(sha256(a), sha256(b));
}

function newDeleteCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

function body(req: VercelRequest): Record<string, unknown> {
  const b = req.body;
  if (b && typeof b === "object" && !Array.isArray(b)) return b as Record<string, unknown>;
  if (typeof b === "string") {
    try {
      const parsed = JSON.parse(b);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      /* gestito sotto */
    }
  }
  throw new HttpError(400, "Richiesta non valida.");
}

function requireMethod(req: VercelRequest, method: "GET" | "POST") {
  if (req.method !== method) throw new HttpError(405, "Metodo non consentito.");
}

// ---------------------------------------------------------------------------
// Presentazione dei dati verso il browser
// ---------------------------------------------------------------------------

function publicNote(n: NoteRow, d: Db) {
  return {
    id: n.id,
    title: n.title,
    subject: n.subject,
    classYear: n.class_year,
    teacher: n.teacher,
    description: n.description,
    fileUrl: d.publicUrl(n.file_path),
    fileName: n.file_name,
    fileSize: n.file_size,
    fileType: n.file_path.split(".").pop(),
    createdAt: n.created_at,
  };
}

function publicBook(b: BookRow) {
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    subject: b.subject,
    classYear: b.class_year,
    price: Number(b.price),
    condition: b.condition,
    instagram: b.instagram,
    hasPhone: Boolean(b.phone),
    createdAt: b.created_at,
  };
}

// ---------------------------------------------------------------------------
// Rotte
// ---------------------------------------------------------------------------

async function route(req: VercelRequest, res: VercelResponse) {
  const r = typeof req.query.r === "string" ? req.query.r : "";
  const d = getDb();

  switch (r) {
    case "notes": {
      if (req.method === "GET") {
        limit(req, "read", 120);
        const rows = await d.listNotes();
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ notes: rows.map((n) => publicNote(n, d)) });
      }
      requireMethod(req, "POST");
      limit(req, "note-write", 6);
      const b = body(req);
      if (b.ownWork !== true) {
        throw new HttpError(400, "Conferma che sono appunti tuoi e non scansioni di libri o verifiche.");
      }
      const path = typeof b.path === "string" ? b.path : "";
      if (!PATH_RE.test(path)) throw new HttpError(400, "File non valido. Ricaricalo.");
      if (!(await d.fileExists(path))) throw new HttpError(400, "Il file non è stato caricato. Riprova.");
      const fileSize = Number(b.fileSize);
      const row = await d.insertNote({
        title: clean(b.title, 80, "titolo")!,
        subject: subject(b.subject, true)!,
        class_year: classYear(b.classYear, true)!,
        teacher: clean(b.teacher, 40, "professore", false),
        description: clean(b.description, 300, "descrizione", false),
        file_path: path,
        file_name: clean(b.fileName, 120, "nome del file", false),
        file_size: Number.isFinite(fileSize) && fileSize > 0 ? Math.round(fileSize) : null,
      });
      return res.status(201).json({ note: publicNote(row, d) });
    }

    case "notes-upload": {
      requireMethod(req, "POST");
      limit(req, "note-upload", 6);
      const b = body(req);
      const type = typeof b.type === "string" ? b.type : "";
      const ext = FILE_TYPES[type];
      if (!ext) throw new HttpError(400, "Puoi caricare solo PDF, JPG o PNG.");
      const size = Number(b.size);
      if (!Number.isFinite(size) || size <= 0) throw new HttpError(400, "Il file è vuoto.");
      if (size > MAX_FILE_BYTES) throw new HttpError(400, "Il file è troppo grande (massimo 10 MB).");
      const path = `${new Date().getFullYear()}/${randomUUID()}.${ext}`;
      const uploadUrl = await d.createUploadUrl(path);
      return res.status(200).json({ path, uploadUrl });
    }

    case "books": {
      if (req.method === "GET") {
        limit(req, "read", 120);
        const rows = await d.listBooks();
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ books: rows.map(publicBook) });
      }
      requireMethod(req, "POST");
      limit(req, "book-write", 5);
      const b = body(req);
      const ph = phone(b.phone);
      const ig = instagram(b.instagram);
      if (!ph && !ig) throw new HttpError(400, "Inserisci il tuo Instagram o il numero di telefono.");
      if (ph && b.phoneConsent !== true) {
        throw new HttpError(400, "Conferma di aver capito che il numero sarà visibile a chi apre il sito.");
      }
      const price = Number(String(b.price ?? "").replace(",", "."));
      if (!Number.isFinite(price) || price < 0 || price > 200) {
        throw new HttpError(400, "Inserisci un prezzo tra 0 e 200 €.");
      }
      const cond = b.condition === undefined || b.condition === "" ? null : b.condition;
      if (cond !== null && !(BOOK_CONDITIONS as readonly unknown[]).includes(cond)) {
        throw new HttpError(400, "Scegli lo stato del libro dall'elenco.");
      }
      const code = newDeleteCode();
      const row = await d.insertBook({
        title: clean(b.title, 100, "titolo")!,
        author: clean(b.author, 80, "autore", false),
        subject: subject(b.subject, false),
        class_year: classYear(b.classYear, false),
        price: Math.round(price * 100) / 100,
        condition: cond as string | null,
        phone: ph,
        instagram: ig,
        delete_code_hash: sha256(code).toString("hex"),
      });
      return res.status(201).json({ book: publicBook(row), deleteCode: code });
    }

    case "book-contact": {
      requireMethod(req, "GET");
      limit(req, "book-contact", 20);
      const id = typeof req.query.id === "string" ? req.query.id : "";
      if (!UUID_RE.test(id)) throw new HttpError(400, "Annuncio non valido.");
      const book = await d.getBook(id);
      if (!book) throw new HttpError(404, "Annuncio non trovato: forse è già stato venduto.");
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ phone: book.phone });
    }

    case "book-delete": {
      requireMethod(req, "POST");
      limit(req, "book-delete", 8);
      const b = body(req);
      const id = typeof b.id === "string" ? b.id : "";
      const code = typeof b.code === "string" ? b.code.trim().toUpperCase() : "";
      if (!UUID_RE.test(id) || !/^[A-Z0-9]{6}$/.test(code)) throw new HttpError(400, "Codice non valido.");
      const book = await d.getBook(id);
      if (!book) throw new HttpError(404, "Annuncio non trovato: forse è già stato cancellato.");
      const ok = timingSafeEqual(Buffer.from(book.delete_code_hash, "hex"), sha256(code));
      if (!ok) throw new HttpError(403, "Codice sbagliato. Controlla di averlo scritto bene.");
      await d.deleteBook(id);
      return res.status(200).json({ ok: true });
    }

    case "admin": {
      requireMethod(req, "POST");
      limit(req, "admin", 20);
      const expected = process.env.ADMIN_PASSWORD;
      if (!expected) throw new HttpError(503, "Password admin non impostata su Vercel.");
      const given = req.headers["x-admin-password"];
      if (typeof given !== "string" || !sameSecret(given, expected)) {
        throw new HttpError(401, "Password sbagliata.");
      }
      const b = body(req);
      const action = b.action;
      if (action === "login") return res.status(200).json({ ok: true });
      if (action === "list") {
        const [notes, books, messages] = await Promise.all([d.listNotes(), d.listBooks(), d.listMessages()]);
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({
          notes: notes.map((n) => publicNote(n, d)),
          books: books.map((bk) => ({ ...publicBook(bk), phone: bk.phone })),
          messages: messages.map((m) => ({ id: m.id, text: m.text, category: m.category, createdAt: m.created_at })),
        });
      }
      if (action === "delete") {
        const id = typeof b.id === "string" ? b.id : "";
        if (!UUID_RE.test(id)) throw new HttpError(400, "Elemento non valido.");
        if (b.kind === "note") await d.deleteNote(id);
        else if (b.kind === "book") await d.deleteBook(id);
        else throw new HttpError(400, "Elemento non valido.");
        return res.status(200).json({ ok: true });
      }
      throw new HttpError(400, "Azione non valida.");
    }

    // Solo sviluppo locale: simula lo storage di Supabase.
    case "dev-upload":
    case "dev-file": {
      if (!memoryDb) throw new HttpError(404, "Non trovato.");
      const path = typeof req.query.path === "string" ? req.query.path : "";
      if (r === "dev-upload") {
        const raw = req.body;
        if (!Buffer.isBuffer(raw)) throw new HttpError(400, "File mancante.");
        memoryDb.files.set(path, { type: String(req.headers["content-type"] ?? ""), body: raw });
        return res.status(200).json({ Key: path });
      }
      const file = memoryDb.files.get(path);
      if (!file) throw new HttpError(404, "File non trovato.");
      res.setHeader("Content-Type", file.type);
      return res.status(200).send(file.body);
    }

    default:
      throw new HttpError(404, "Non trovato.");
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await route(req, res);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Errore /api/hub:", err);
    return res.status(500).json({ error: "Qualcosa è andato storto. Riprova tra poco." });
  }
}
