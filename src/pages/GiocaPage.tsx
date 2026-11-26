import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import logo from "../assets/logo.png";
import {
  ANNI,
  ANNO_MAX,
  ANNO_MIN,
  ApiError,
  DOMANDA_STELLA,
  SEZIONI,
  type StatoAssemblea,
  leggiStato,
  mandaParola,
  mandaRisposta,
  ricorda,
} from "../lib/assemblea";

const POLL_MS = 3000;

/** Pagina dei telefoni: si apre dal QR sullo schermo (#/gioca). */
export default function GiocaPage() {
  const [stato, setStato] = useState<StatoAssemblea | null>(null);
  const [offline, setOffline] = useState(false);
  const [classe, setClasse] = useState(() => ricorda("classe"));

  useEffect(() => {
    let vivo = true;
    let timer: number;
    const giro = async () => {
      try {
        const s = await leggiStato();
        if (!vivo) return;
        setStato(s);
        setOffline(false);
      } catch {
        if (vivo) setOffline(true);
      }
      if (vivo) timer = window.setTimeout(giro, document.hidden ? POLL_MS * 3 : POLL_MS);
    };
    giro();
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-[100svh] max-w-md flex-col px-5 pb-10" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="" className="h-8 w-8 rounded-full ring-1 ring-white/10" />
          <span className="text-sm font-semibold text-mist/90">Assemblea</span>
        </div>
        {classe && (
          <button
            onClick={() => {
              ricorda("classe", "");
              setClasse("");
            }}
            className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-gold-300"
          >
            {classe} · cambia
          </button>
        )}
      </div>

      {offline && (
        <p className="mt-2 rounded-2xl border border-gold-400/30 bg-gold-500/10 px-4 py-2.5 text-center text-xs font-medium text-gold-300">
          Il segnale è debole: provo a ricollegarmi da solo. Non chiudere la pagina.
        </p>
      )}

      <div className="flex flex-1 flex-col justify-center py-6">
        {!classe ? (
          <SceltaClasse
            onScelta={(c) => {
              ricorda("classe", c);
              setClasse(c);
            }}
          />
        ) : !stato ? (
          <Attesa titolo="Mi collego…" testo="Ci vuole un attimo se il segnale è debole." />
        ) : (
          <Gioco stato={stato} classe={classe} />
        )}
      </div>

      <p className="text-center text-[11px] text-mist/30">
        Nova Severi · Rappresentanza studentesca · Anonimo: nessun nome, solo la classe
      </p>
    </div>
  );
}

function SceltaClasse({ onScelta }: { onScelta: (c: string) => void }) {
  const [anno, setAnno] = useState<number | null>(null);
  return (
    <div className="animate-fade-up text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">Prima di tutto</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-mist">In che classe sei?</h1>
      <p className="mt-3 text-sm text-mist/60">Nel quiz si gioca per la classe. Il tuo nome non serve.</p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {ANNI.map((a) => (
          <button
            key={a}
            onClick={() => setAnno(a)}
            className={`rounded-2xl border py-5 font-display text-3xl font-semibold transition ${
              anno === a ? "border-gold-400 bg-gold-500/15 text-gold-300" : "border-white/10 bg-white/[0.04] text-mist"
            }`}
          >
            {a}ª
          </button>
        ))}
      </div>

      {anno && (
        <div className="mt-6 grid animate-fade-up grid-cols-4 gap-2.5">
          {SEZIONI.map((s) => (
            <button
              key={s}
              onClick={() => onScelta(`${anno}${s}`)}
              className="rounded-2xl border border-white/10 bg-white/[0.04] py-4 text-xl font-semibold text-mist transition active:scale-95 active:bg-azure-500"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Attesa({ titolo, testo, grande }: { titolo: string; testo?: string; grande?: string }) {
  return (
    <div className="animate-fade-up text-center">
      <div className="mx-auto mb-6 h-16 w-16 animate-pulse rounded-full bg-gold-400/20 shadow-gold" />
      {grande && <p className="font-display text-7xl font-semibold text-gold-300">{grande}</p>}
      <h1 className="mt-2 font-display text-3xl font-semibold text-mist">{titolo}</h1>
      {testo && <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-mist/60">{testo}</p>}
    </div>
  );
}

function Gioco({ stato, classe }: { stato: StatoAssemblea; classe: string }) {
  const { fase, stella, quiz, giro } = stato;
  const chiave = (k: string) => `${k}:${giro}`;

  if (fase === "stella") {
    const mandata = ricorda(chiave("parola"));
    if (mandata) {
      return <Attesa titolo="Guarda lo schermo" testo={`La tua parola «${mandata}» sta per diventare una stella.`} />;
    }
    if (!stella.aperta) return <Attesa titolo="Tra poco tocca a te" testo="Appena si apre, qui compare dove scrivere." />;
    return <FormParola onInviata={(p) => ricorda(chiave("parola"), p)} />;
  }

  if (fase === "quiz") {
    const mia = ricorda(chiave("q" + quiz.domanda));
    if (quiz.stato === "aperta" && !mia) {
      return <FormAnno key={quiz.domanda} stato={stato} classe={classe} onInviata={(a) => ricorda(chiave("q" + quiz.domanda), String(a))} />;
    }
    if ((quiz.stato === "risposta" || quiz.stato === "classifica") && quiz.anno) {
      const diff = mia ? Math.abs(Number(mia) - quiz.anno) : null;
      return (
        <Attesa
          grande={String(quiz.anno)}
          titolo={diff === null ? "Era questo l'anno" : diff === 0 ? "Esatto. Bravissimo." : `Hai sbagliato di ${diff} ${diff === 1 ? "anno" : "anni"}`}
          testo={mia ? `Avevi detto ${mia}.` : "Questa volta non hai risposto."}
        />
      );
    }
    if (mia) return <Attesa titolo="Risposta inviata" grande={mia} testo="Guarda lo schermo: tra poco si scopre l'anno." />;
    return <Attesa titolo={`Domanda ${quiz.domanda + 1}`} testo="Si sta per aprire. Tieni il telefono in mano." />;
  }

  if (fase === "rumore") return <Attesa titolo="Facciamo rumore" testo="Telefono giù. Chiavi in mano, in piedi." />;
  if (fase === "fine") {
    return (
      <Attesa
        grande="1522"
        titolo="Numero antiviolenza e antistalking"
        testo="Gratuito, attivo giorno e notte. Salvalo in rubrica: può servire a te o a qualcuno vicino a te."
      />
    );
  }
  return <Attesa titolo="Si comincia tra poco" testo="Tieni aperta questa pagina: i giochi compaiono qui da soli." />;
}

/** Riprova da sola se il segnale cade: in sala non prende bene. */
function useInvio() {
  const [stato, setStato] = useState<"pronto" | "invio" | "errore">("pronto");
  const [errore, setErrore] = useState<string | null>(null);
  const vivo = useRef(true);
  useEffect(() => () => void (vivo.current = false), []);

  const invia = useCallback(async (fn: () => Promise<unknown>, ok: () => void) => {
    setStato("invio");
    setErrore(null);
    for (let tentativo = 0; tentativo < 12 && vivo.current; tentativo++) {
      try {
        await fn();
        ok();
        return;
      } catch (e) {
        const err = e as ApiError;
        if (err.status === 409) {
          // già mandata o tempo scaduto: non ha senso riprovare
          setErrore(err.message);
          setStato("errore");
          if (/già/.test(err.message)) ok();
          return;
        }
        if (err.status >= 400 && err.status < 500 && err.status !== 429) {
          setErrore(err.message);
          setStato("errore");
          return;
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
    if (vivo.current) {
      setErrore("Non riesco a inviare: avvicinati alla porta o accendi i dati, poi riprova.");
      setStato("errore");
    }
  }, []);

  return { stato, errore, invia };
}

function FormParola({ onInviata }: { onInviata: (p: string) => void }) {
  const [parola, setParola] = useState("");
  const [fatto, setFatto] = useState(false);
  const { stato, errore, invia } = useInvio();
  const pulita = parola.trim();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!pulita) return;
    invia(() => mandaParola(pulita), () => {
      onInviata(pulita);
      setFatto(true);
    });
  }

  if (fatto) return <Attesa titolo="Guarda lo schermo" testo={`La tua parola «${pulita}» sta per diventare una stella.`} />;

  return (
    <form onSubmit={submit} className="animate-fade-up text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">Accendi una stella</p>
      <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-mist">{DOMANDA_STELLA}</h1>
      <p className="mt-3 text-sm text-mist/60">Una parola. Diventerà una stella sullo schermo.</p>
      <input
        value={parola}
        onChange={(e) => setParola(e.target.value.replace(/[^\p{L}' -]/gu, ""))}
        maxLength={24}
        autoFocus
        enterKeyHint="send"
        placeholder="La tua parola"
        className="mt-8 w-full rounded-2xl border border-white/15 bg-night-900/70 px-5 py-4 text-center text-2xl font-semibold text-mist placeholder:text-mist/25 focus:border-gold-400 focus:outline-none"
      />
      {errore && <p className="mt-3 text-sm text-gold-300">{errore}</p>}
      <button
        disabled={!pulita || stato === "invio"}
        className="mt-5 w-full rounded-2xl bg-gradient-to-b from-gold-400 to-gold-500 py-4 text-lg font-bold text-night-950 shadow-gold transition active:scale-[0.98] disabled:opacity-50"
      >
        {stato === "invio" ? "Invio… (se il segnale è debole ci metto un po')" : "Accendi ✦"}
      </button>
    </form>
  );
}

function FormAnno({
  stato,
  classe,
  onInviata,
}: {
  stato: StatoAssemblea;
  classe: string;
  onInviata: (anno: number) => void;
}) {
  const [anno, setAnno] = useState(1970);
  const [fatto, setFatto] = useState(false);
  const { stato: invio, errore, invia } = useInvio();
  const q = stato.quiz;
  const sposta = (d: number) => setAnno((a) => Math.min(ANNO_MAX, Math.max(ANNO_MIN, a + d)));

  if (fatto) return <Attesa titolo="Risposta inviata" grande={String(anno)} testo="Guarda lo schermo: tra poco si scopre l'anno." />;

  return (
    <div className="animate-fade-up text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">
        Indovina l'anno · {q.domanda + 1}/{q.totale}
      </p>
      <h1 className="mt-3 font-display text-[26px] font-semibold leading-snug text-mist">{q.testo}</h1>

      <p className="mt-8 font-display text-7xl font-semibold tabular-nums text-gold-300">{anno}</p>
      <input
        type="range"
        min={ANNO_MIN}
        max={ANNO_MAX}
        value={anno}
        onChange={(e) => setAnno(Number(e.target.value))}
        className="mt-6 w-full accent-[#D8B65A]"
        aria-label="Anno"
      />
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[-10, -1, 1, 10].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => sposta(d)}
            className="rounded-2xl border border-white/10 bg-white/[0.05] py-3 text-lg font-semibold text-mist active:scale-95"
          >
            {d > 0 ? `+${d}` : d}
          </button>
        ))}
      </div>
      {errore && <p className="mt-3 text-sm text-gold-300">{errore}</p>}
      <button
        disabled={invio === "invio"}
        onClick={() =>
          invia(() => mandaRisposta(q.domanda, anno, classe), () => {
            onInviata(anno);
            setFatto(true);
          })
        }
        className="mt-5 w-full rounded-2xl bg-gradient-to-b from-gold-400 to-gold-500 py-4 text-lg font-bold text-night-950 shadow-gold transition active:scale-[0.98] disabled:opacity-50"
      >
        {invio === "invio" ? "Invio…" : `Rispondo ${anno}`}
      </button>
      <p className="mt-3 text-xs text-mist/40">Giochi per la {classe}. Più ti avvicini, più punti fa la tua classe.</p>
    </div>
  );
}
