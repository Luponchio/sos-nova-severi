import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BOOK_CONDITIONS, formatDate, formatPhone, formatPrice, normalize } from "../lib/catalog";
import {
  createBook,
  deleteBookWithCode,
  fetchBookPhone,
  fetchBooks,
  rememberCode,
  savedCode,
  type Book,
} from "../lib/hub";
import {
  Checkbox,
  ClassSelect,
  ErrorBox,
  Field,
  Filters,
  ListState,
  PageIntro,
  Spinner,
  SubjectSelect,
  Tag,
  cardClass,
  ghostButton,
  inputClass,
  primaryButton,
} from "../components/ui";

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [published, setPublished] = useState<{ title: string; code: string } | null>(null);

  const [search, setSearch] = useState("");
  const [classYear, setClassYear] = useState<number | null>(null);
  const [subject, setSubject] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBooks(await fetchBooks());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = normalize(search.trim());
    return books.filter(
      (b) =>
        (classYear === null || b.classYear === classYear) &&
        (!subject || b.subject === subject) &&
        (!q || normalize([b.title, b.author ?? "", b.subject ?? ""].join(" ")).includes(q))
    );
  }, [books, search, classYear, subject]);

  return (
    <>
      <PageIntro kicker="Libri usati" title="Libri usati del Severi">
        Compra e vendi i libri di testo tra studenti. Vi accordate direttamente voi, senza intermediari.
      </PageIntro>

      <div className="space-y-5">
        {published && <PublishedCard {...published} onClose={() => setPublished(null)} />}

        {showForm ? (
          <SellForm
            onCancel={() => setShowForm(false)}
            onDone={(book, code) => {
              rememberCode(book.id, code);
              setBooks((prev) => [book, ...prev]);
              setShowForm(false);
              setPublished({ title: book.title, code });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        ) : (
          <button
            type="button"
            className={primaryButton}
            onClick={() => {
              setPublished(null);
              setShowForm(true);
            }}
          >
            <span aria-hidden="true" className="text-lg leading-none">+</span> Vendi un libro
          </button>
        )}

        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-mist/55">
          Consiglio: fate lo scambio a scuola o in un posto frequentato, controllate il libro e pagate alla consegna.
        </p>

        <Filters
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Cerca titolo o autore…"
          classYear={classYear}
          onClassYear={setClassYear}
          subject={subject}
          onSubject={setSubject}
        />

        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && visible.length === 0}
          onRetry={load}
          emptyText={
            books.length === 0
              ? "Ancora nessun libro in vendita. Pubblica il primo annuncio!"
              : "Nessun libro con questi filtri."
          }
        />

        {!loading && !error && visible.length > 0 && (
          <>
            <p className="text-xs text-mist/40">
              {visible.length} {visible.length === 1 ? "libro" : "libri"} in vendita
            </p>
            <ul className="space-y-3">
              {visible.map((b) => (
                <li key={b.id}>
                  <BookCard book={b} onRemoved={() => setBooks((prev) => prev.filter((x) => x.id !== b.id))} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

function PublishedCard({ title, code, onClose }: { title: string; code: string; onClose: () => void }) {
  return (
    <div role="status" className={`${cardClass} animate-fade-up border-gold-400/40 text-center shadow-gold`}>
      <p className="text-sm text-mist/70">
        Annuncio pubblicato: <span className="font-semibold text-mist">{title}</span>
      </p>
      <p className="mt-4 text-xs uppercase tracking-[0.25em] text-mist/45">Il tuo codice per cancellarlo</p>
      <p className="mt-1 font-mono text-4xl font-bold tracking-[0.3em] text-gold-300">{code}</p>
      <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-mist/55">
        Fai uno screenshot. Quando vendi il libro, premi "Venduto?" sull'annuncio e inserisci questo codice.
      </p>
      <button type="button" onClick={onClose} className={`${ghostButton} mt-4`}>
        Ho salvato il codice
      </button>
    </div>
  );
}

function BookCard({ book, onRemoved }: { book: Book; onRemoved: () => void }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneState, setPhoneState] = useState<"idle" | "loading" | "error">("idle");
  const [phoneError, setPhoneError] = useState("");
  const [removing, setRemoving] = useState(false);
  const [code, setCode] = useState("");
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  async function revealPhone() {
    setPhoneState("loading");
    try {
      const p = await fetchBookPhone(book.id);
      setPhone(p);
      setPhoneState("idle");
    } catch (e) {
      setPhoneError((e as Error).message);
      setPhoneState("error");
    }
  }

  async function remove(e: FormEvent) {
    e.preventDefault();
    setRemoveError(null);
    setRemoveBusy(true);
    try {
      await deleteBookWithCode(book.id, code);
      onRemoved();
    } catch (err) {
      setRemoveError((err as Error).message);
      setRemoveBusy(false);
    }
  }

  const waNumber = phone?.replace("+", "");

  return (
    <article className={`${cardClass} animate-fade-up`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            {book.classYear && <Tag tone="gold">{book.classYear}ª</Tag>}
            {book.subject && <Tag tone="azure">{book.subject}</Tag>}
            {book.condition && <Tag>{book.condition}</Tag>}
          </div>
          <h2 className="mt-3 text-lg font-semibold leading-snug text-mist">{book.title}</h2>
          {book.author && <p className="mt-0.5 text-sm text-mist/55">{book.author}</p>}
        </div>
        <p className="shrink-0 font-display text-2xl font-semibold text-gold-300">{formatPrice(book.price)}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {book.instagram && (
          <a
            href={`https://instagram.com/${book.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            className={ghostButton}
          >
            @{book.instagram}
          </a>
        )}
        {book.hasPhone && !phone && (
          <button type="button" onClick={revealPhone} className={ghostButton} disabled={phoneState === "loading"}>
            {phoneState === "loading" ? <Spinner /> : null} Mostra numero
          </button>
        )}
        {phone && (
          <>
            <a href={`tel:${phone}`} className={ghostButton}>
              {formatPhone(phone)}
            </a>
            <a
              href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Ciao! Ho visto su Nova Severi il tuo annuncio: ${book.title}. È ancora disponibile?`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${ghostButton} border-emerald-400/30 text-emerald-200`}
            >
              WhatsApp
            </a>
          </>
        )}
      </div>
      {phoneState === "error" && <p className="mt-2 text-xs text-red-200">{phoneError}</p>}

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
        <p className="text-xs text-mist/40">{formatDate(book.createdAt)}</p>
        {!removing && (
          <button
            type="button"
            onClick={() => {
              setCode(savedCode(book.id));
              setRemoving(true);
            }}
            className="text-xs text-mist/45 underline-offset-2 hover:text-mist hover:underline"
          >
            Venduto? Rimuovi l'annuncio
          </button>
        )}
      </div>

      {removing && (
        <form onSubmit={remove} className="mt-3 space-y-2">
          <label htmlFor={`code-${book.id}`} className="block text-xs text-mist/60">
            Inserisci il codice che hai ricevuto quando hai pubblicato l'annuncio
          </label>
          <div className="flex gap-2">
            <input
              id={`code-${book.id}`}
              value={code}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className={`${inputClass} font-mono tracking-[0.25em]`}
            />
            <button type="submit" disabled={removeBusy || code.length !== 6} className={`${ghostButton} shrink-0`}>
              {removeBusy ? <Spinner /> : "Rimuovi"}
            </button>
          </div>
          {removeError && <ErrorBox>{removeError}</ErrorBox>}
          <button type="button" onClick={() => setRemoving(false)} className="text-xs text-mist/45 hover:text-mist">
            Annulla
          </button>
        </form>
      )}
    </article>
  );
}

function SellForm({ onCancel, onDone }: { onCancel: () => void; onDone: (b: Book, code: string) => void }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subject, setSubject] = useState("");
  const [classYear, setClassYear] = useState("");
  const [condition, setCondition] = useState("");
  const [price, setPrice] = useState("");
  const [instagram, setInstagram] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneConsent, setPhoneConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!title.trim()) return setError("Scrivi il titolo del libro.");
    if (price.trim() === "") return setError("Inserisci il prezzo (0 se lo regali).");
    if (!instagram.trim() && !phone.trim()) return setError("Inserisci il tuo Instagram o il numero di telefono.");
    if (phone.trim() && !phoneConsent) return setError("Conferma di aver capito che il numero sarà visibile.");

    setBusy(true);
    try {
      const { book, deleteCode } = await createBook({
        title,
        author,
        subject,
        classYear,
        condition,
        price,
        instagram,
        phone,
        phoneConsent,
      });
      onDone(book, deleteCode);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className={`${cardClass} scroll-mt-32 shadow-azure`}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-mist">Vendi un libro</h2>
        <button type="button" onClick={onCancel} className="text-sm text-mist/50 hover:text-mist" disabled={busy}>
          Annulla
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <Field label="Titolo del libro" htmlFor="book-title">
          <input
            id="book-title"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Es. L'Amaldi per i licei scientifici 2"
            className={inputClass}
          />
        </Field>

        <Field label="Autore o editore" hint="(facoltativo)" htmlFor="book-author">
          <input
            id="book-author"
            value={author}
            maxLength={80}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Es. Amaldi, Zanichelli"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Materia" htmlFor="book-subject">
            <SubjectSelect id="book-subject" value={subject} onChange={setSubject} placeholder="Scegli" />
          </Field>
          <Field label="Classe" htmlFor="book-class">
            <ClassSelect id="book-class" value={classYear} onChange={setClassYear} placeholder="Scegli" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Stato" htmlFor="book-condition">
            <select id="book-condition" value={condition} onChange={(e) => setCondition(e.target.value)} className={inputClass}>
              <option value="">Scegli</option>
              {BOOK_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prezzo (€)" htmlFor="book-price">
            <input
              id="book-price"
              value={price}
              inputMode="decimal"
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder="Es. 15"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="rounded-2xl border border-white/10 bg-night-900/30 p-4">
          <p className="text-sm font-medium text-mist/80">Come ti contattano</p>
          <p className="mt-0.5 text-xs text-mist/45">Inserisci almeno uno dei due.</p>
          <div className="mt-3 space-y-3">
            <Field label="Instagram" htmlFor="book-ig">
              <input
                id="book-ig"
                value={instagram}
                maxLength={60}
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@tuonome"
                className={inputClass}
              />
            </Field>
            <Field label="Telefono" hint="(facoltativo)" htmlFor="book-phone">
              <input
                id="book-phone"
                type="tel"
                value={phone}
                maxLength={20}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="333 123 4567"
                className={inputClass}
              />
            </Field>
            {phone.trim() && (
              <Checkbox id="book-consent" checked={phoneConsent} onChange={setPhoneConsent}>
                Ho capito che il mio numero sarà visibile a chiunque apra il sito e prema "Mostra numero".
              </Checkbox>
            )}
          </div>
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}

        <button type="submit" className={primaryButton} disabled={busy}>
          {busy ? (
            <>
              <Spinner /> Pubblicazione…
            </>
          ) : (
            "Pubblica l'annuncio"
          )}
        </button>
      </div>
    </form>
  );
}
