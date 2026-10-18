import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ACCEPTED_FILE_TYPES, MAX_FILE_BYTES, formatDate, formatSize, normalize } from "../lib/catalog";
import { fetchNotes, uploadNote, type Note } from "../lib/hub";
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

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [justPublished, setJustPublished] = useState(false);

  const [search, setSearch] = useState("");
  const [classYear, setClassYear] = useState<number | null>(null);
  const [subject, setSubject] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setNotes(await fetchNotes());
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
    return notes.filter(
      (n) =>
        (classYear === null || n.classYear === classYear) &&
        (!subject || n.subject === subject) &&
        (!q || normalize([n.title, n.subject, n.teacher ?? "", n.description ?? ""].join(" ")).includes(q))
    );
  }, [notes, search, classYear, subject]);

  return (
    <>
      <PageIntro kicker="Appunti" title="Appunti del Severi">
        Scritti da studenti, per studenti. Cerca per classe, materia o professore e scarica gratis.
      </PageIntro>

      <div className="space-y-5">
        {showForm ? (
          <UploadForm
            onCancel={() => setShowForm(false)}
            onDone={(note) => {
              setNotes((prev) => [note, ...prev]);
              setShowForm(false);
              setJustPublished(true);
            }}
          />
        ) : (
          <button
            type="button"
            className={primaryButton}
            onClick={() => {
              setJustPublished(false);
              setShowForm(true);
            }}
          >
            <span aria-hidden="true" className="text-lg leading-none">+</span> Carica i tuoi appunti
          </button>
        )}

        {justPublished && (
          <p role="status" className="rounded-xl border border-gold-400/30 bg-gold-500/10 px-4 py-2.5 text-center text-sm text-gold-300">
            Pubblicato! Grazie: i tuoi appunti ora aiutano tutto il Severi.
          </p>
        )}

        <Filters
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Cerca: limiti, Dante, prof. Rossi…"
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
            notes.length === 0
              ? "Ancora nessun appunto. Carica il primo e aiuta chi viene dopo di te."
              : "Nessun appunto con questi filtri."
          }
        />

        {!loading && !error && visible.length > 0 && (
          <>
            <p className="text-xs text-mist/40">
              {visible.length} {visible.length === 1 ? "appunto" : "appunti"}
            </p>
            <ul className="space-y-3">
              {visible.map((n) => (
                <li key={n.id}>
                  <NoteCard note={n} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

function NoteCard({ note }: { note: Note }) {
  return (
    <article className={`${cardClass} animate-fade-up`}>
      <div className="flex flex-wrap gap-1.5">
        <Tag tone="gold">{note.classYear}ª</Tag>
        <Tag tone="azure">{note.subject}</Tag>
        {note.teacher && <Tag>Prof. {note.teacher}</Tag>}
      </div>
      <h2 className="mt-3 text-lg font-semibold leading-snug text-mist">{note.title}</h2>
      {note.description && <p className="mt-1.5 text-sm leading-relaxed text-mist/60">{note.description}</p>}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-mist/40">
          {note.fileType.toUpperCase()}
          {note.fileSize ? ` · ${formatSize(note.fileSize)}` : ""} · {formatDate(note.createdAt)}
        </p>
        <a href={note.fileUrl} target="_blank" rel="noopener noreferrer" className={ghostButton}>
          Apri
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
            <path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </article>
  );
}

function UploadForm({ onCancel, onDone }: { onCancel: () => void; onDone: (n: Note) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [classYear, setClassYear] = useState("");
  const [teacher, setTeacher] = useState("");
  const [description, setDescription] = useState("");
  const [ownWork, setOwnWork] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  function pickFile(f: File | undefined) {
    setError(null);
    if (!f) return setFile(null);
    if (!ACCEPTED_FILE_TYPES.includes(f.type)) {
      setFile(null);
      return setError("Puoi caricare solo PDF, JPG o PNG.");
    }
    if (f.size > MAX_FILE_BYTES) {
      setFile(null);
      return setError("Il file è troppo grande (massimo 10 MB). Prova a esportarlo come PDF compresso.");
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 80));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (progress !== null) return;
    setError(null);
    if (!file) return setError("Scegli il file da caricare.");
    if (!title.trim()) return setError("Dai un titolo agli appunti.");
    if (!subject) return setError("Scegli la materia.");
    if (!classYear) return setError("Scegli la classe.");
    if (!ownWork) return setError("Conferma che sono appunti tuoi.");

    setProgress(0);
    try {
      const note = await uploadNote(
        { file, title, subject, classYear: Number(classYear), teacher, description, ownWork },
        setProgress
      );
      onDone(note);
    } catch (err) {
      setError((err as Error).message);
      setProgress(null);
    }
  }

  const busy = progress !== null;

  return (
    <form ref={formRef} onSubmit={submit} noValidate className={`${cardClass} scroll-mt-32 shadow-azure`}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-mist">Carica appunti</h2>
        <button type="button" onClick={onCancel} className="text-sm text-mist/50 hover:text-mist" disabled={busy}>
          Annulla
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <label
          htmlFor="note-file"
          className={`flex cursor-pointer flex-col items-center rounded-2xl border border-dashed px-4 py-6 text-center transition ${
            file ? "border-gold-400/50 bg-gold-500/[0.06]" : "border-white/15 bg-night-900/40 hover:border-azure-400/60"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-azure-300" fill="none" aria-hidden="true">
            <path d="M12 16V4m0 0l-4 4m4-4l4 4M5 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {file ? (
            <>
              <span className="mt-2 max-w-full truncate text-sm font-semibold text-gold-300">{file.name}</span>
              <span className="text-xs text-mist/45">{formatSize(file.size)} · tocca per cambiarlo</span>
            </>
          ) : (
            <>
              <span className="mt-2 text-sm font-semibold text-mist">Scegli un file</span>
              <span className="text-xs text-mist/45">PDF, JPG o PNG · massimo 10 MB</span>
            </>
          )}
          <input
            id="note-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="sr-only"
            disabled={busy}
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </label>

        <Field label="Titolo" htmlFor="note-title">
          <input
            id="note-title"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Es. Limiti e derivate, riassunto"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Materia" htmlFor="note-subject">
            <SubjectSelect id="note-subject" value={subject} onChange={setSubject} placeholder="Scegli" />
          </Field>
          <Field label="Classe" htmlFor="note-class">
            <ClassSelect id="note-class" value={classYear} onChange={setClassYear} placeholder="Scegli" />
          </Field>
        </div>

        <Field label="Professore" hint="(facoltativo)" htmlFor="note-teacher">
          <input
            id="note-teacher"
            value={teacher}
            maxLength={40}
            onChange={(e) => setTeacher(e.target.value)}
            placeholder="Es. Rossi"
            className={inputClass}
          />
        </Field>

        <Field label="Descrizione" hint="(facoltativa)" htmlFor="note-desc">
          <textarea
            id="note-desc"
            value={description}
            maxLength={300}
            rows={2}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Cosa c'è dentro, per quale verifica sono utili…"
            className={`${inputClass} resize-none`}
          />
        </Field>

        <Checkbox id="note-own" checked={ownWork} onChange={setOwnWork}>
          Sono appunti miei: non sono scansioni di libri, di verifiche o materiale protetto.
        </Checkbox>

        {error && <ErrorBox>{error}</ErrorBox>}

        {busy && (
          <div aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-azure-500 to-gold-400 transition-[width] duration-300"
                style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-center text-xs text-mist/50">
              {progress! < 1 ? `Caricamento ${Math.round(progress! * 100)}%` : "Quasi fatto…"}
            </p>
          </div>
        )}

        <button type="submit" className={primaryButton} disabled={busy}>
          {busy ? (
            <>
              <Spinner /> Pubblicazione…
            </>
          ) : (
            "Pubblica gli appunti"
          )}
        </button>
        <p className="text-center text-xs text-mist/40">
          Gli appunti sono visibili a tutti. La rappresentanza può rimuovere contenuti inappropriati.
        </p>
      </div>
    </form>
  );
}
