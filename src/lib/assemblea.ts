// Chiamate a /api/assemblea e dati condivisi dei giochi dell'assemblea.
// Nessun segreto qui: la password della regia la scrive chi usa la regia.

/** Copiate da api/assemblea.ts: servono allo schermo quando gira senza rete. */
export const DOMANDE: { testo: string; anno: number }[] = [
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

/** La frase che le stelle accendono. */
export const FRASE = "RISPETTO";
export const DOMANDA_STELLA = "Cosa vuol dire rispetto, per te?";

/** In sala ci sono quarte e quinte: si possono aggiungere altri anni qui. */
export const ANNI = [4, 5];
export const SEZIONI = ["A", "B", "C", "D", "E", "F", "G", "H"];

export const ANNO_MIN = 1900;
export const ANNO_MAX = 2026;

export type Fase = "attesa" | "stella" | "rumore" | "quiz" | "fine";
export type StatoQuiz = "pronta" | "aperta" | "chiusa" | "risposta" | "classifica";

export interface Parola {
  id: string;
  parola: string;
}

export interface StatoAssemblea {
  fase: Fase;
  versione: number;
  giro: number;
  stella: { aperta: boolean; obiettivo: number; accendiTutto: boolean; parole: Parola[] };
  quiz: {
    domanda: number;
    totale: number;
    testo: string;
    stato: StatoQuiz;
    risposte: number;
    anno?: number;
    tentativi?: number[];
    migliore?: string;
    classifica?: { classe: string; punti: number; giocatori: number }[];
  };
}

export interface StatoRegia extends StatoAssemblea {
  attesa: Parola[];
  domande: { testo: string; anno: number }[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const DEBOLE = "Connessione debole: riprovo da solo.";

/** Fetch con tempo massimo: in sala il segnale va e viene, meglio fallire presto e riprovare. */
async function call<T>(path: string, init: RequestInit = {}, ms = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  let res: Response;
  try {
    res = await fetch(path, { ...init, signal: ctrl.signal, cache: "no-store" });
  } catch {
    throw new ApiError(0, DEBOLE);
  } finally {
    clearTimeout(t);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* risposta vuota */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? DEBOLE;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const leggiStato = () => call<StatoAssemblea>("/api/assemblea");

function post<T>(path: string, body: unknown, headers: Record<string, string> = {}) {
  return call<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

export const mandaParola = (parola: string) => post("/api/assemblea", { tipo: "parola", parola, device: deviceId() });

export const mandaRisposta = (domanda: number, anno: number, classe: string) =>
  post("/api/assemblea", { tipo: "risposta", domanda, anno, classe, device: deviceId() });

export const regiaLeggi = (pw: string) =>
  call<StatoRegia>("/api/assemblea?r=regia", { headers: { "x-admin-password": pw } });

export const regiaAzione = (pw: string, body: Record<string, unknown>) =>
  post("/api/assemblea?r=regia", body, { "x-admin-password": pw });

// ---------------------------------------------------------------------------
// Piccole memorie del telefono (se il browser non le permette, si va avanti lo stesso)
// ---------------------------------------------------------------------------

export function ricorda(key: string, value?: string): string {
  try {
    if (value === undefined) return localStorage.getItem("nova-assemblea:" + key) ?? "";
    if (value === "") localStorage.removeItem("nova-assemblea:" + key);
    else localStorage.setItem("nova-assemblea:" + key, value);
  } catch {
    /* modalità privata: pazienza */
  }
  return value ?? "";
}

let memDevice = "";
export function deviceId(): string {
  let id = ricorda("device") || memDevice;
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
    memDevice = id;
    ricorda("device", id);
  }
  return id;
}
