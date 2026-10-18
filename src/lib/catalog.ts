// Elenchi condivisi da Appunti e Libri usati.
// Tienili allineati con le costanti in cima ad api/hub.ts.

export const SUBJECTS = [
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

export const CLASS_YEARS = [1, 2, 3, 4, 5] as const;

export const BOOK_CONDITIONS = ["Come nuovo", "Buono", "Usato", "Con sottolineature"] as const;

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });
const priceFmt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso));
}

export function formatPrice(value: number) {
  return value === 0 ? "Gratis" : priceFmt.format(value);
}

export function formatSize(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function formatPhone(p: string) {
  const local = p.replace(/^\+39/, "");
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/** Ricerca senza accenti né maiuscole. */
export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
