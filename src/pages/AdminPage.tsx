import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatDate, formatPhone, formatPrice } from "../lib/catalog";
import { CATEGORIES } from "../lib/validation";
import { ApiError, adminDelete, adminList, adminLogin, type AdminBook, type AdminMessage, type Note } from "../lib/hub";
import { ErrorBox, PageIntro, Spinner, Tag, cardClass, ghostButton, inputClass, primaryButton } from "../components/ui";

const PW_KEY = "nova-severi:admin";

function readPw() {
  try {
    return sessionStorage.getItem(PW_KEY) ?? "";
  } catch {
    return "";
  }
}

function writePw(pw: string) {
  try {
    if (pw) sessionStorage.setItem(PW_KEY, pw);
    else sessionStorage.removeItem(PW_KEY);
  } catch {
    /* va bene anche senza: si rifà il login */
  }
}

type Tab = "notes" | "books" | "messages";

export default function AdminPage() {
  const [password, setPassword] = useState(readPw);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const saved = readPw();
    if (!saved) return;
    adminLogin(saved)
      .then(() => setLoggedIn(true))
      .catch(() => writePw(""));
  }, []);

  function logout() {
    writePw("");
    setPassword("");
    setLoggedIn(false);
  }

  return loggedIn ? (
    <Dashboard password={password} onLogout={logout} />
  ) : (
    <Login
      onSuccess={(pw) => {
        writePw(pw);
        setPassword(pw);
        setLoggedIn(true);
      }}
    />
  );
}

function Login({ onSuccess }: { onSuccess: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminLogin(pw);
      onSuccess(pw);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <PageIntro kicker="Area riservata" title="Admin">
        Rimuovi appunti e annunci inappropriati e leggi i messaggi di S.O.S.
      </PageIntro>
      <form onSubmit={submit} className={`${cardClass} space-y-4`}>
        <label htmlFor="admin-pw" className="block text-sm font-medium text-mist/75">
          Password
        </label>
        <input
          id="admin-pw"
          type="password"
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className={inputClass}
        />
        {error && <ErrorBox>{error}</ErrorBox>}
        <button type="submit" disabled={busy || !pw} className={primaryButton}>
          {busy ? <Spinner /> : "Entra"}
        </button>
      </form>
    </>
  );
}

function Dashboard({ password, onLogout }: { password: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("notes");
  const [notes, setNotes] = useState<Note[]>([]);
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminList(password);
      setNotes(data.notes);
      setBooks(data.books);
      setMessages(data.messages);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onLogout();
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [password, onLogout]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(kind: "note" | "book", id: string, label: string) {
    if (!window.confirm(`Rimuovere definitivamente "${label}"?`)) return;
    setDeleting(id);
    try {
      await adminDelete(password, kind, id);
      if (kind === "note") setNotes((p) => p.filter((n) => n.id !== id));
      else setBooks((p) => p.filter((b) => b.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "notes", label: "Appunti", count: notes.length },
    { id: "books", label: "Libri", count: books.length },
    { id: "messages", label: "S.O.S.", count: messages.length },
  ];

  const deleteButton = (kind: "note" | "book", id: string, label: string) => (
    <button
      type="button"
      onClick={() => remove(kind, id, label)}
      disabled={deleting === id}
      className={`${ghostButton} shrink-0 border-red-400/30 text-red-200 hover:border-red-400/60 hover:text-red-100`}
    >
      {deleting === id ? <Spinner /> : "Rimuovi"}
    </button>
  );

  return (
    <div className="space-y-5 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold text-mist">Admin</h1>
        <div className="flex gap-2">
          <button type="button" onClick={load} className={ghostButton} disabled={loading}>
            Aggiorna
          </button>
          <button type="button" onClick={onLogout} className={ghostButton}>
            Esci
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-2 py-2 text-sm font-semibold transition ${
              tab === t.id ? "bg-gradient-to-b from-azure-500 to-azure-600 text-white" : "text-mist/60 hover:text-mist"
            }`}
          >
            {t.label} <span className="opacity-60">{loading ? "" : t.count}</span>
          </button>
        ))}
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      {loading && (
        <div className="flex justify-center py-10 text-mist/50">
          <Spinner />
        </div>
      )}

      {!loading && tab === "notes" && (
        <ul className="space-y-3">
          {notes.length === 0 && <Empty />}
          {notes.map((n) => (
            <li key={n.id} className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-mist">{n.title}</p>
                  <p className="mt-1 text-xs text-mist/50">
                    {n.classYear}ª · {n.subject}
                    {n.teacher ? ` · Prof. ${n.teacher}` : ""} · {formatDate(n.createdAt)}
                  </p>
                  {n.description && <p className="mt-2 text-sm text-mist/65">{n.description}</p>}
                  <a href={n.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-azure-300 underline">
                    Apri il file
                  </a>
                </div>
                {deleteButton("note", n.id, n.title)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && tab === "books" && (
        <ul className="space-y-3">
          {books.length === 0 && <Empty />}
          {books.map((b) => (
            <li key={b.id} className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-mist">
                    {b.title} <span className="text-gold-300">{formatPrice(b.price)}</span>
                  </p>
                  <p className="mt-1 text-xs text-mist/50">
                    {[b.author, b.classYear ? `${b.classYear}ª` : null, b.subject, formatDate(b.createdAt)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-2 text-sm text-mist/65">
                    {[b.instagram ? `@${b.instagram}` : null, b.phone ? formatPhone(b.phone) : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {deleteButton("book", b.id, b.title)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && tab === "messages" && (
        <ul className="space-y-3">
          {messages.length === 0 && <Empty />}
          {messages.map((m) => {
            const cat = CATEGORIES.find((c) => c.id === m.category);
            return (
              <li key={m.id} className={cardClass}>
                <div className="flex flex-wrap items-center gap-2">
                  {cat && (
                    <Tag tone="gold">
                      {cat.emoji} {cat.label}
                    </Tag>
                  )}
                  <span className="text-xs text-mist/45">{formatDate(m.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-mist/85">{m.text}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Empty() {
  return <li className="py-8 text-center text-sm text-mist/45">Niente da mostrare.</li>;
}
