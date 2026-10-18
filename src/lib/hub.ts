// Chiamate a /api/hub (Appunti, Libri usati, Admin). Nessun segreto qui:
// tutto ciò che è riservato vive sul server.

export interface Note {
  id: string;
  title: string;
  subject: string;
  classYear: number;
  teacher: string | null;
  description: string | null;
  fileUrl: string;
  fileName: string | null;
  fileSize: number | null;
  fileType: string;
  createdAt: string;
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  subject: string | null;
  classYear: number | null;
  price: number;
  condition: string | null;
  instagram: string | null;
  hasPhone: boolean;
  createdAt: string;
}

export interface AdminBook extends Book {
  phone: string | null;
}

export interface AdminMessage {
  id: string;
  text: string;
  category: string | null;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const GENERIC = "Qualcosa è andato storto. Controlla la connessione e riprova.";

async function call<T>(r: string, init?: RequestInit & { query?: Record<string, string> }): Promise<T> {
  const params = new URLSearchParams({ r, ...(init?.query ?? {}) });
  let res: Response;
  try {
    res = await fetch(`/api/hub?${params}`, init);
  } catch {
    throw new ApiError(0, GENERIC);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* risposta non JSON */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? GENERIC;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

function post<T>(r: string, payload: unknown, headers: Record<string, string> = {}) {
  return call<T>(r, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
}

// ---- Appunti ---------------------------------------------------------------

export async function fetchNotes() {
  return (await call<{ notes: Note[] }>("notes")).notes;
}

export interface NewNote {
  file: File;
  title: string;
  subject: string;
  classYear: number;
  teacher: string;
  description: string;
  ownWork: boolean;
}

/** Carica il file direttamente nello storage (con avanzamento) e poi salva i dati. */
export async function uploadNote(input: NewNote, onProgress: (fraction: number) => void) {
  const { path, uploadUrl } = await post<{ path: string; uploadUrl: string }>("notes-upload", {
    type: input.file.type,
    size: input.file.size,
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", input.file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, "Il caricamento del file non è riuscito. Riprova."));
    xhr.onerror = () => reject(new ApiError(0, GENERIC));
    xhr.send(input.file);
  });

  onProgress(1);
  const { note } = await post<{ note: Note }>("notes", {
    path,
    title: input.title,
    subject: input.subject,
    classYear: input.classYear,
    teacher: input.teacher,
    description: input.description,
    fileName: input.file.name,
    fileSize: input.file.size,
    ownWork: input.ownWork,
  });
  return note;
}

// ---- Libri usati -----------------------------------------------------------

export async function fetchBooks() {
  return (await call<{ books: Book[] }>("books")).books;
}

export interface NewBook {
  title: string;
  author: string;
  subject: string;
  classYear: string;
  condition: string;
  price: string;
  instagram: string;
  phone: string;
  phoneConsent: boolean;
}

export function createBook(input: NewBook) {
  return post<{ book: Book; deleteCode: string }>("books", input);
}

export async function fetchBookPhone(id: string) {
  return (await call<{ phone: string | null }>("book-contact", { query: { id } })).phone;
}

export function deleteBookWithCode(id: string, code: string) {
  return post<{ ok: true }>("book-delete", { id, code });
}

const CODES_KEY = "nova-severi:book-codes";

/** Ricorda sul dispositivo del venditore il codice dei suoi annunci. */
export function rememberCode(id: string, code: string) {
  try {
    const all = JSON.parse(localStorage.getItem(CODES_KEY) ?? "{}");
    all[id] = code;
    localStorage.setItem(CODES_KEY, JSON.stringify(all));
  } catch {
    /* storage non disponibile: il venditore ha comunque il codice a schermo */
  }
}

export function savedCode(id: string): string {
  try {
    return JSON.parse(localStorage.getItem(CODES_KEY) ?? "{}")[id] ?? "";
  } catch {
    return "";
  }
}

// ---- Admin -----------------------------------------------------------------

export function adminLogin(password: string) {
  return post<{ ok: true }>("admin", { action: "login" }, { "x-admin-password": password });
}

export function adminList(password: string) {
  return post<{ notes: Note[]; books: AdminBook[]; messages: AdminMessage[] }>(
    "admin",
    { action: "list" },
    { "x-admin-password": password }
  );
}

export function adminDelete(password: string, kind: "note" | "book", id: string) {
  return post<{ ok: true }>("admin", { action: "delete", kind, id }, { "x-admin-password": password });
}
