import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import logo from "../assets/logo.png";
import Costellazione from "../components/Costellazione";
import {
  ANNO_MAX,
  ANNO_MIN,
  DOMANDA_STELLA,
  DOMANDE,
  FRASE,
  type Fase,
  type Parola,
  type StatoAssemblea,
  type StatoQuiz,
  leggiStato,
} from "../lib/assemblea";

/**
 * Pagina per il proiettore (#/schermo).
 * - "Collegato": la comandate dal telefono, dalla regia (#/regia). I telefoni giocano.
 * - "Senza rete": tutto da questo computer, con i tasti. Funziona anche se in sala non prende.
 */
export default function SchermoPage() {
  const [modo, setModo] = useState<"scelta" | "online" | "offline">("scelta");

  if (modo === "scelta") return <Avvio onScelta={setModo} />;
  return modo === "online" ? <SchermoOnline /> : <SchermoOffline />;
}

function schermoIntero() {
  document.documentElement.requestFullscreen?.().catch(() => {});
}

function Avvio({ onScelta }: { onScelta: (m: "online" | "offline") => void }) {
  return (
    <Sfondo>
      <div className="flex h-full flex-col items-center justify-center gap-8 px-8 text-center">
        <img src={logo} alt="" className="h-20 w-20 rounded-full ring-1 ring-white/10" />
        <h1 className="font-display text-5xl font-semibold text-mist">Schermo dell'assemblea</h1>
        <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
          <button
            onClick={() => {
              schermoIntero();
              onScelta("online");
            }}
            className="rounded-3xl border border-gold-400/50 bg-gold-500/10 p-6 text-left transition hover:bg-gold-500/20"
          >
            <p className="text-2xl font-semibold text-gold-300">Collegato</p>
            <p className="mt-2 text-sm leading-relaxed text-mist/70">
              Gli studenti giocano dal telefono. Lo comandate dalla regia sul vostro telefono.
            </p>
          </button>
          <button
            onClick={() => {
              schermoIntero();
              onScelta("offline");
            }}
            className="rounded-3xl border border-white/15 bg-white/[0.04] p-6 text-left transition hover:bg-white/[0.08]"
          >
            <p className="text-2xl font-semibold text-mist">Senza rete</p>
            <p className="mt-2 text-sm leading-relaxed text-mist/70">
              Se in sala non prende. Le parole le scrivete voi, il quiz si gioca ad alta voce.
            </p>
          </button>
        </div>
        <p className="text-xs text-mist/40">Schermo intero: tasto F11. Per uscire: Esc.</p>
      </div>
    </Sfondo>
  );
}

// ---------------------------------------------------------------------------
// Collegato: legge lo stato ogni 1,5 secondi
// ---------------------------------------------------------------------------

function SchermoOnline() {
  const [stato, setStato] = useState<StatoAssemblea | null>(null);
  const [debole, setDebole] = useState(false);

  useEffect(() => {
    let vivo = true;
    let timer: number;
    const giro = async () => {
      try {
        const s = await leggiStato();
        if (!vivo) return;
        setStato(s);
        setDebole(false);
      } catch {
        if (vivo) setDebole(true);
      }
      if (vivo) timer = window.setTimeout(giro, 1500);
    };
    giro();
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, []);

  if (!stato) {
    return (
      <Sfondo>
        <div className="flex h-full items-center justify-center text-2xl text-mist/60">
          {debole ? "Non riesco a collegarmi. Provate «Senza rete» o un hotspot." : "Mi collego…"}
        </div>
      </Sfondo>
    );
  }

  return (
    <Sfondo>
      <Scena
        online
        fase={stato.fase}
        parole={stato.stella.parole}
        obiettivo={stato.stella.obiettivo}
        accendiTutto={stato.stella.accendiTutto}
        stellaAperta={stato.stella.aperta}
        quiz={stato.quiz}
      />
      {debole && (
        <p className="absolute right-6 top-5 rounded-full bg-night-950/70 px-3 py-1 text-xs text-gold-300">segnale debole…</p>
      )}
    </Sfondo>
  );
}

// ---------------------------------------------------------------------------
// Senza rete: stesso schermo, comandato dalla tastiera e dalla barra in basso
// ---------------------------------------------------------------------------

function SchermoOffline() {
  const [fase, setFase] = useState<Fase>("attesa");
  const [parole, setParole] = useState<Parola[]>([]);
  const [tutto, setTutto] = useState(false);
  const [obiettivo, setObiettivo] = useState(25);
  const [domanda, setDomanda] = useState(0);
  const [statoQuiz, setStatoQuiz] = useState<StatoQuiz>("aperta");
  const [barra, setBarra] = useState(true);
  const [parola, setParola] = useState("");
  const [rumore, setRumore] = useState(0);
  const timer = useRef<number>();

  const mostraBarra = () => {
    setBarra(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setBarra(false), 4000);
  };

  useEffect(() => {
    mostraBarra();
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      const fasi: Record<string, Fase> = { "1": "attesa", "2": "stella", "3": "quiz", "4": "rumore", "5": "fine" };
      if (fasi[e.key]) setFase(fasi[e.key]);
      if (e.key === "ArrowRight") vai(1);
      if (e.key === "ArrowLeft") vai(-1);
      if (e.key === " ") {
        e.preventDefault();
        setStatoQuiz((s) => (s === "aperta" ? "risposta" : "aperta"));
        setRumore((r) => r + 1);
      }
      mostraBarra();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", mostraBarra);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", mostraBarra);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function vai(d: number) {
    setDomanda((q) => Math.min(DOMANDE.length - 1, Math.max(0, q + d)));
    setStatoQuiz("aperta");
  }

  function aggiungi(e: FormEvent) {
    e.preventDefault();
    const p = parola.trim();
    if (!p) return;
    setParole((l) => [...l, { id: `${Date.now()}-${l.length}`, parola: p.charAt(0).toUpperCase() + p.slice(1) }]);
    setParola("");
  }

  const q = DOMANDE[domanda];

  return (
    <Sfondo>
      <Scena
        key={fase === "rumore" ? `r${rumore}` : fase}
        fase={fase}
        parole={parole}
        obiettivo={obiettivo}
        accendiTutto={tutto}
        stellaAperta
        quiz={{
          domanda,
          totale: DOMANDE.length,
          testo: q.testo,
          stato: statoQuiz,
          risposte: 0,
          anno: statoQuiz === "risposta" ? q.anno : undefined,
        }}
      />

      <div
        className={`absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 bg-night-950/85 px-4 py-3 backdrop-blur transition-opacity duration-500 ${
          barra ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {(
          [
            ["attesa", "1 Inizio"],
            ["stella", "2 Stelle"],
            ["quiz", "3 Quiz"],
            ["rumore", "4 Rumore"],
            ["fine", "5 Il 1522"],
          ] as [Fase, string][]
        ).map(([f, l]) => (
          <button key={f} onClick={() => setFase(f)} className={pulsante(fase === f)}>
            {l}
          </button>
        ))}
        <span className="mx-2 h-6 w-px bg-white/15" />
        {fase === "stella" && (
          <>
            <form onSubmit={aggiungi} className="flex gap-2">
              <input
                value={parola}
                onChange={(e) => setParola(e.target.value)}
                maxLength={24}
                placeholder="Parola detta in sala, poi Invio"
                className="w-64 rounded-full border border-white/15 bg-night-900 px-4 py-1.5 text-sm text-mist focus:border-gold-400 focus:outline-none"
              />
            </form>
            <label className="flex items-center gap-1.5 text-xs text-mist/60">
              obiettivo
              <input
                type="number"
                min={5}
                max={200}
                value={obiettivo}
                onChange={(e) => setObiettivo(Math.max(5, Number(e.target.value) || 5))}
                className="w-16 rounded-full border border-white/15 bg-night-900 px-2 py-1 text-center text-sm text-mist"
              />
            </label>
            <button onClick={() => setTutto(true)} className={pulsante(tutto)}>
              Accendi tutto
            </button>
          </>
        )}
        {fase === "quiz" && (
          <>
            <button onClick={() => vai(-1)} className={pulsante(false)}>
              ← Prima
            </button>
            <span className="text-sm text-mist/70">
              {domanda + 1}/{DOMANDE.length}
            </span>
            <button onClick={() => setStatoQuiz(statoQuiz === "aperta" ? "risposta" : "aperta")} className={pulsante(true)}>
              {statoQuiz === "aperta" ? "Rivela (spazio)" : "Nascondi"}
            </button>
            <button onClick={() => vai(1)} className={pulsante(false)}>
              Dopo →
            </button>
          </>
        )}
        {fase === "rumore" && (
          <button onClick={() => setRumore((r) => r + 1)} className={pulsante(true)}>
            Ricomincia il minuto
          </button>
        )}
      </div>
    </Sfondo>
  );
}

const pulsante = (attivo: boolean) =>
  `rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
    attivo ? "bg-gold-400 text-night-950" : "border border-white/15 text-mist/80 hover:border-gold-400/60"
  }`;

// ---------------------------------------------------------------------------
// Le scene
// ---------------------------------------------------------------------------

function Sfondo({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_50%_42%,#02A8EC_0%,#0036C5_62%,#001a66_100%)] text-mist">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_30%,rgba(4,10,24,0.55)_100%)]" />
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}

interface ScenaProps {
  online?: boolean;
  fase: Fase;
  parole: Parola[];
  obiettivo: number;
  accendiTutto: boolean;
  stellaAperta: boolean;
  quiz: StatoAssemblea["quiz"];
}

function Scena(p: ScenaProps) {
  const url = `${window.location.origin}/#/gioca`;

  if (p.fase === "stella") {
    const accese = p.accendiTutto ? p.obiettivo : Math.min(p.parole.length, p.obiettivo);
    return (
      <>
        <Costellazione frase={FRASE} parole={p.parole} obiettivo={p.obiettivo} accendiTutto={p.accendiTutto} />
        <div className="absolute inset-x-0 top-[6vh] text-center">
          <p className="text-[1.6vw] font-semibold uppercase tracking-[0.35em] text-gold-300">Accendi una stella</p>
          <h1 className="mt-2 font-display text-[3.4vw] font-semibold">{DOMANDA_STELLA}</h1>
        </div>
        <div className="absolute bottom-[4vh] left-[3vw] flex items-end gap-4">
          {p.online && p.stellaAperta && <Qr url={url} size="13vw" />}
          <p className="pb-1 text-[1.5vw] text-mist/80">
            <span className="font-display text-[3vw] font-semibold text-gold-300">{p.parole.length}</span>{" "}
            {p.parole.length === 1 ? "stella accesa" : "stelle accese"}
            {accese >= p.obiettivo && <span className="ml-3 text-gold-300">✦ completata</span>}
          </p>
        </div>
        <img src={logo} alt="" className="absolute bottom-[4vh] right-[3vw] h-[6vw] w-[6vw] rounded-full opacity-90" />
      </>
    );
  }

  if (p.fase === "quiz") return <Quiz q={p.quiz} online={!!p.online} url={url} />;
  if (p.fase === "rumore") return <Rumore />;

  if (p.fase === "fine") {
    return (
      <div className="flex h-full animate-fade-up flex-col items-center justify-center text-center">
        <p className="text-[1.6vw] font-semibold uppercase tracking-[0.35em] text-gold-300">Salvatelo in rubrica</p>
        <p className="mt-2 font-display text-[18vw] font-semibold leading-none text-gold-300 drop-shadow-[0_0_60px_rgba(255,214,102,0.35)]">1522</p>
        <p className="mt-4 text-[2.4vw] font-semibold">Numero antiviolenza e antistalking</p>
        <p className="mt-2 text-[1.7vw] text-mist/75">Gratuito, attivo 24 ore su 24. Anche per chi vuole aiutare un'amica.</p>
        <img src={logo} alt="Nova Severi" className="mt-[5vh] h-[6vw] w-[6vw] rounded-full" />
      </div>
    );
  }

  // attesa
  return (
    <div className="flex h-full animate-fade-up items-center justify-center gap-[6vw] px-[6vw]">
      <div className="max-w-[48vw]">
        <p className="text-[1.6vw] font-semibold uppercase tracking-[0.35em] text-gold-300">Assemblea d'istituto</p>
        <h1 className="mt-3 font-display text-[5.5vw] font-semibold leading-[1.02]">Adesso tocca a voi.</h1>
        <p className="mt-5 text-[1.9vw] leading-snug text-mist/80">
          {p.online
            ? "Inquadrate il QR, scegliete la vostra classe e tenete aperta la pagina: i giochi compaiono da soli."
            : "Due giochi, tutta la sala insieme. Preparatevi a rispondere ad alta voce."}
        </p>
      </div>
      {p.online && <Qr url={url} size="26vw" etichetta={url.replace(/^https?:\/\//, "")} />}
    </div>
  );
}

function Qr({ url, size, etichetta }: { url: string; size: string; etichetta?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#040A18", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [url]);
  return (
    <div className="text-center">
      <div
        className="rounded-[1.2vw] bg-white p-[0.8vw] shadow-[0_0_60px_rgba(255,214,102,0.25)] [&>svg]:h-full [&>svg]:w-full"
        style={{ width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {etichetta && <p className="mt-3 text-[1.3vw] font-semibold text-mist/80">{etichetta}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

function Quiz({ q, online, url }: { q: StatoAssemblea["quiz"]; online: boolean; url: string }) {
  if (q.stato === "classifica" && q.classifica) return <Classifica righe={q.classifica} />;
  const rivelata = q.anno !== undefined && (q.stato === "risposta" || q.stato === "classifica");

  return (
    <div className="flex h-full flex-col px-[6vw] pb-[5vh] pt-[7vh]">
      <p className="text-[1.6vw] font-semibold uppercase tracking-[0.35em] text-gold-300">
        Indovina l'anno · {q.domanda + 1}/{q.totale}
      </p>
      <h1 key={q.domanda} className="mt-3 max-w-[80vw] animate-fade-up font-display text-[4.2vw] font-semibold leading-[1.08]">
        {q.testo}
      </h1>

      <div className="flex flex-1 items-center">
        {rivelata ? (
          <Rivelazione anno={q.anno!} tentativi={q.tentativi ?? []} migliore={q.migliore} />
        ) : (
          <div className="flex w-full items-center justify-between">
            <p className="font-display text-[9vw] font-semibold leading-none text-white/20">In che anno?</p>
            {online && (
              <div className="flex items-end gap-6">
                <div className="text-right">
                  <p className="font-display text-[5vw] font-semibold leading-none text-gold-300">{q.risposte}</p>
                  <p className="text-[1.5vw] text-mist/70">{q.stato === "aperta" ? "risposte" : "risposte · chiuso"}</p>
                </div>
                {q.stato === "aperta" && <Qr url={url} size="14vw" />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Rivelazione({ anno, tentativi, migliore }: { anno: number; tentativi: number[]; migliore?: string }) {
  const [mostrato, setMostrato] = useState(ANNO_MIN);
  const [fatto, setFatto] = useState(false);

  useEffect(() => {
    const inizio = performance.now();
    const durata = 2200;
    let raf = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - inizio) / durata);
      const e = 1 - Math.pow(1 - k, 4);
      setMostrato(Math.round(ANNO_MIN + (anno - ANNO_MIN) * e));
      if (k < 1) raf = requestAnimationFrame(passo);
      else setFatto(true);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [anno]);

  const pos = (a: number) => ((Math.min(ANNO_MAX, Math.max(ANNO_MIN, a)) - ANNO_MIN) / (ANNO_MAX - ANNO_MIN)) * 100;

  // pallini dei tentativi, impilati se cadono vicini
  const pallini = useMemo(() => {
    const pile = new Map<number, number>();
    return tentativi.map((a, i) => {
      const cella = Math.round(a / 2);
      const h = pile.get(cella) ?? 0;
      pile.set(cella, h + 1);
      return { a, h, i };
    });
  }, [tentativi]);

  return (
    <div className="w-full">
      <div className="flex items-baseline gap-6">
        <p className={`font-display text-[13vw] font-semibold leading-none tabular-nums ${fatto ? "text-gold-300" : "text-white"}`}>
          {mostrato}
        </p>
        {fatto && migliore && (
          <p className="animate-fade-up text-[2vw] text-mist/85">
            Il più vicino: <span className="font-semibold text-gold-300">{migliore.replace(/^(\d)/, "$1ª ")}</span>
          </p>
        )}
      </div>

      <div className="relative mt-[4vh] h-[16vh]">
        {pallini.map(({ a, h, i }) => (
          <span
            key={i}
            className="absolute h-[0.9vw] w-[0.9vw] -translate-x-1/2 animate-fade-up rounded-full bg-azure-300/80"
            style={{ left: `${pos(a)}%`, bottom: `${1.2 + h * 1.1}vw`, animationDelay: `${Math.min(i * 25, 1500)}ms` }}
          />
        ))}
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/30" />
        {[1900, 1920, 1940, 1960, 1980, 2000, 2020].map((y) => (
          <span key={y} className="absolute -bottom-[3.2vh] -translate-x-1/2 text-[1.1vw] text-mist/50" style={{ left: `${pos(y)}%` }}>
            {y}
          </span>
        ))}
        <div
          className="absolute bottom-0 top-[-2vh] w-[3px] bg-gold-300 shadow-[0_0_20px_rgba(255,214,102,0.9)] transition-[left] duration-100"
          style={{ left: `${pos(mostrato)}%` }}
        />
      </div>
    </div>
  );
}

function Classifica({ righe }: { righe: { classe: string; punti: number; giocatori: number }[] }) {
  const max = Math.max(1, ...righe.map((r) => r.punti));
  return (
    <div className="flex h-full flex-col px-[8vw] py-[7vh]">
      <p className="text-[1.6vw] font-semibold uppercase tracking-[0.35em] text-gold-300">Indovina l'anno</p>
      <h1 className="mt-2 font-display text-[4.5vw] font-semibold">Classifica delle classi</h1>
      <div className="mt-[4vh] flex flex-1 flex-col justify-center gap-[1.6vh]">
        {righe.length === 0 && <p className="text-[2vw] text-mist/60">Ancora nessuna risposta.</p>}
        {righe.slice(0, 8).map((r, i) => (
          <div key={r.classe} className="flex animate-fade-up items-center gap-4" style={{ animationDelay: `${i * 120}ms` }}>
            <span className="w-[7vw] font-display text-[2.6vw] font-semibold">{r.classe.replace(/^(\d)/, "$1ª ")}</span>
            <div className="h-[4.5vh] flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${i === 0 ? "bg-gold-300" : "bg-azure-300/80"} transition-[width] duration-1000 ease-out`}
                style={{ width: `${(r.punti / max) * 100}%` }}
              />
            </div>
            <span className="w-[9vw] text-right text-[2vw] font-semibold tabular-nums">{r.punti}</span>
          </div>
        ))}
      </div>
      <p className="text-[1.2vw] text-mist/50">Punti medi a giocatore: una classe piccola può battere una grande.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Minuto di rumore
// ---------------------------------------------------------------------------

function Rumore() {
  const [resto, setResto] = useState(60);
  useEffect(() => {
    const inizio = Date.now();
    const id = window.setInterval(() => setResto(Math.max(0, 60 - Math.floor((Date.now() - inizio) / 1000))), 200);
    return () => clearInterval(id);
  }, []);
  const giro = (resto / 60) * 100;
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-[1.6vw] font-semibold uppercase tracking-[0.35em] text-gold-300">Per Giulia. Per tutte.</p>
      <h1 className={`mt-3 font-display text-[8vw] font-semibold leading-none ${resto > 0 ? "animate-pulse" : ""}`}>
        {resto > 0 ? "Facciamo rumore." : "Grazie."}
      </h1>
      <div
        className="relative mt-[6vh] grid h-[22vh] w-[22vh] place-items-center rounded-full"
        style={{ background: `conic-gradient(#FFD666 ${giro}%, rgba(255,255,255,0.12) 0)` }}
      >
        <div className="grid h-[19vh] w-[19vh] place-items-center rounded-full bg-[#0036C5]">
          <span className="font-display text-[7vh] font-semibold tabular-nums">{resto}</span>
        </div>
      </div>
      <p className="mt-[4vh] text-[1.8vw] text-mist/80">In piedi. Chiavi, mani, voce: un minuto per chi non ha più voce.</p>
    </div>
  );
}
