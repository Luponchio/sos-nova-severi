import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError, type Fase, type StatoRegia, type StatoQuiz, regiaAzione, regiaLeggi } from "../lib/assemblea";
import { ErrorBox, cardClass, inputClass, primaryButton } from "../components/ui";

const PW_KEY = "nova-severi:admin"; // stessa password e stessa memoria della pagina admin

function leggiPw() {
  try {
    return sessionStorage.getItem(PW_KEY) ?? "";
  } catch {
    return "";
  }
}
function scriviPw(pw: string) {
  try {
    if (pw) sessionStorage.setItem(PW_KEY, pw);
    else sessionStorage.removeItem(PW_KEY);
  } catch {
    /* si rifà il login */
  }
}

/** Regia dal telefono (#/regia): comanda lo schermo e approva le parole. */
export default function RegiaPage() {
  const [pw, setPw] = useState(leggiPw);
  const [dentro, setDentro] = useState(false);

  useEffect(() => {
    const salvata = leggiPw();
    if (salvata) regiaLeggi(salvata).then(() => setDentro(true)).catch(() => scriviPw(""));
  }, []);

  if (!dentro) {
    return (
      <Login
        onOk={(p) => {
          scriviPw(p);
          setPw(p);
          setDentro(true);
        }}
      />
    );
  }
  return (
    <Pannello
      pw={pw}
      onEsci={() => {
        scriviPw("");
        setDentro(false);
      }}
    />
  );
}

function Login({ onOk }: { onOk: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrore(null);
    try {
      await regiaLeggi(pw);
      onOk(pw);
    } catch (err) {
      setErrore((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-md px-5 pt-16">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">Assemblea</p>
      <h1 className="mt-3 text-center font-display text-4xl font-semibold">Regia</h1>
      <form onSubmit={submit} className={`${cardClass} mt-8 space-y-4`}>
        <label htmlFor="regia-pw" className="block text-sm text-mist/70">
          Password admin (la stessa del sito S.O.S.)
        </label>
        <input id="regia-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputClass} />
        {errore && <ErrorBox>{errore}</ErrorBox>}
        <button disabled={!pw || busy} className={primaryButton}>
          {busy ? "Controllo…" : "Entra"}
        </button>
      </form>
    </div>
  );
}

const FASI: [Fase, string][] = [
  ["attesa", "Inizio + QR"],
  ["stella", "Stelle"],
  ["quiz", "Quiz"],
  ["rumore", "Rumore"],
  ["fine", "1522"],
];

function Pannello({ pw, onEsci }: { pw: string; onEsci: () => void }) {
  const [s, setS] = useState<StatoRegia | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manuale, setManuale] = useState("");

  const carica = useCallback(async () => {
    try {
      setS(await regiaLeggi(pw));
      setErrore(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onEsci();
      setErrore((e as Error).message);
    }
  }, [pw, onEsci]);

  useEffect(() => {
    carica();
    const id = window.setInterval(carica, 2500);
    return () => clearInterval(id);
  }, [carica]);

  async function fai(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await regiaAzione(pw, body);
      await carica();
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const patch = (p: Record<string, unknown>) => fai({ azione: "stato", patch: p });

  async function giudica(id: string, ok: boolean) {
    setS((x) => (x ? { ...x, attesa: x.attesa.filter((p) => p.id !== id) } : x));
    try {
      await regiaAzione(pw, { azione: "parola", id, ok });
    } catch (e) {
      setErrore((e as Error).message);
      carica();
    }
  }

  if (!s) return <p className="pt-20 text-center text-mist/60">{errore ?? "Carico…"}</p>;
  const q = s.quiz;
  const prossimo: Record<StatoQuiz, [string, StatoQuiz] | null> = {
    pronta: ["Apri le risposte", "aperta"],
    aperta: ["Chiudi le risposte", "chiusa"],
    chiusa: ["Rivela l'anno", "risposta"],
    risposta: ["Mostra la classifica", "classifica"],
    classifica: null,
  };
  const passo = prossimo[q.stato];

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 pb-16 pt-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Regia</h1>
        <div className="flex items-center gap-3 text-xs">
          <span className={errore ? "text-gold-300" : "text-emerald-300"}>{errore ? "segnale debole" : "collegata"}</span>
          <button onClick={onEsci} className="text-mist/50 underline">
            esci
          </button>
        </div>
      </div>

      <section className={cardClass}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-mist/50">Sullo schermo</p>
        <div className="grid grid-cols-3 gap-2">
          {FASI.map(([f, l]) => (
            <button
              key={f}
              disabled={busy}
              onClick={() => patch({ fase: f })}
              className={`rounded-xl py-3 text-sm font-semibold ${
                s.fase === f ? "bg-gold-400 text-night-950" : "border border-white/10 bg-white/[0.04]"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </section>

      {s.fase === "stella" && (
        <section className={`${cardClass} space-y-3`}>
          <div className="flex items-center justify-between">
            <p className="text-sm">
              <b className="text-gold-300">{s.stella.parole.length}</b> stelle su <b>{s.stella.obiettivo}</b>
            </p>
            <button
              disabled={busy}
              onClick={() => patch({ stellaAperta: !s.stella.aperta })}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                s.stella.aperta ? "bg-emerald-400 text-night-950" : "border border-white/20"
              }`}
            >
              {s.stella.aperta ? "Aperta: chiudi" : "Apri le parole"}
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-mist/70">
            Obiettivo
            {[15, 25, 40, 60].map((n) => (
              <button
                key={n}
                onClick={() => patch({ obiettivo: n })}
                className={`rounded-full px-3 py-1 ${s.stella.obiettivo === n ? "bg-white/20 text-mist" : "border border-white/10"}`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-mist/45">L'obiettivo è quante parole servono per accendere tutta la scritta. Mettetelo un po' sotto le persone in sala.</p>

          <p className="pt-2 text-xs font-semibold uppercase tracking-widest text-mist/50">Da approvare ({s.attesa.length})</p>
          {s.attesa.length === 0 && <p className="text-sm text-mist/40">Nessuna parola in attesa.</p>}
          <ul className="space-y-2">
            {s.attesa.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2">
                <span className="flex-1 text-lg font-semibold">{p.parola}</span>
                <button onClick={() => giudica(p.id, false)} className="rounded-lg border border-white/15 px-3 py-2 text-sm" aria-label="Scarta">
                  ✕
                </button>
                <button onClick={() => giudica(p.id, true)} className="rounded-lg bg-gold-400 px-4 py-2 text-sm font-bold text-night-950">
                  ✓ Sì
                </button>
              </li>
            ))}
          </ul>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manuale.trim()) fai({ azione: "aggiungi", parola: manuale.trim() });
              setManuale("");
            }}
            className="flex gap-2 pt-1"
          >
            <input value={manuale} onChange={(e) => setManuale(e.target.value)} maxLength={24} placeholder="Parola detta a voce" className={inputClass} />
            <button className="rounded-2xl border border-white/15 px-4 text-sm font-semibold">Aggiungi</button>
          </form>
          <button
            disabled={busy}
            onClick={() => patch({ accendiTutto: !s.stella.accendiTutto })}
            className="w-full rounded-2xl border border-gold-400/50 py-3 text-sm font-semibold text-gold-300"
          >
            {s.stella.accendiTutto ? "Torna al conteggio vero" : "✦ Accendi tutta la scritta"}
          </button>
        </section>
      )}

      {s.fase === "quiz" && (
        <section className={`${cardClass} space-y-3`}>
          <div className="flex items-center justify-between">
            <button
              disabled={busy || q.domanda === 0}
              onClick={() => patch({ domanda: q.domanda - 1, statoQuiz: "pronta" })}
              className="rounded-full border border-white/15 px-3 py-1.5 text-sm disabled:opacity-30"
            >
              ←
            </button>
            <p className="text-sm text-mist/70">
              Domanda <b className="text-mist">{q.domanda + 1}</b> di {q.totale}
            </p>
            <button
              disabled={busy || q.domanda >= q.totale - 1}
              onClick={() => patch({ domanda: q.domanda + 1, statoQuiz: "pronta" })}
              className="rounded-full border border-white/15 px-3 py-1.5 text-sm disabled:opacity-30"
            >
              →
            </button>
          </div>
          <p className="text-lg font-semibold leading-snug">{q.testo}</p>
          <p className="text-sm text-mist/60">
            Risposta: <b className="text-gold-300">{s.domande[q.domanda]?.anno}</b> · stato: {q.stato} · {q.risposte} risposte
          </p>
          {passo ? (
            <button disabled={busy} onClick={() => patch({ statoQuiz: passo[1] })} className={primaryButton}>
              {passo[0]}
            </button>
          ) : q.domanda < q.totale - 1 ? (
            <button disabled={busy} onClick={() => patch({ domanda: q.domanda + 1, statoQuiz: "pronta" })} className={primaryButton}>
              Prossima domanda →
            </button>
          ) : (
            <p className="text-center text-sm text-mist/60">Era l'ultima domanda.</p>
          )}
          {q.stato === "aperta" && <p className="text-xs text-mist/45">Lasciate 20-30 secondi: col segnale debole le risposte arrivano in ritardo.</p>}

          <div className="border-t border-white/10 pt-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-mist/50">Classifica dal vivo (solo tu vedi i PIN)</p>
            {s.podio.length === 0 && <p className="mt-2 text-sm text-mist/40">Ancora nessuna risposta.</p>}
            <ol className="mt-2 space-y-1.5">
              {s.podio.slice(0, 5).map((r, i) => (
                <li key={r.codice + i} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${i < 3 ? "bg-gold-500/10" : "bg-white/[0.03]"}`}>
                  <span className="w-6 text-sm text-mist/60">{i + 1}°</span>
                  <span className="flex-1 font-mono text-lg font-bold tracking-widest">{r.codice}</span>
                  <span className="text-xs text-mist/60">{r.punti} pt</span>
                  <span className="rounded-lg bg-night-950/60 px-2 py-1 font-mono text-sm text-gold-300">PIN {r.pin}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-mist/45">
              Quando sale sul palco, fatevi mostrare il telefono: il PIN sul suo schermo deve essere uguale a questo.
            </p>
          </div>
        </section>
      )}

      {errore && <ErrorBox>{errore}</ErrorBox>}

      <details className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-mist/60">
        <summary className="cursor-pointer">Prove e azzeramento</summary>
        <p className="mt-2 text-xs">Dopo le prove, azzerate tutto prima dell'assemblea.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              ["parole", "Parole"],
              ["risposte", "Risposte"],
              ["tutto", "Tutto"],
            ] as const
          ).map(([cosa, l]) => (
            <button
              key={cosa}
              onClick={() => window.confirm(`Cancellare ${cosa === "tutto" ? "tutto" : "le " + cosa}? Non si torna indietro.`) && fai({ azione: "azzera", cosa })}
              className="rounded-xl border border-red-300/30 py-2 text-red-200"
            >
              {l}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
