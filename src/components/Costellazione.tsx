import { useEffect, useRef } from "react";
import type { Parola } from "../lib/assemblea";

interface Props {
  frase: string;
  parole: Parola[];
  obiettivo: number;
  accendiTutto: boolean;
}

interface Punto {
  x: number;
  y: number;
  da: { x: number; y: number };
  accesa: number; // ms in cui si accende; Infinity = spenta
  fase: number;
}

interface Etichetta {
  testo: string;
  x: number;
  y: number;
  nata: number;
}

const VOLO_MS = 1300;
const ETICHETTA_MS = 4200;

/** Generatore pseudocasuale con seme: le stelle hanno sempre lo stesso ordine. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Ogni parola approvata diventa una stella che vola via dalla parola stessa
 * e accende un pezzo della frase. Più parole arrivano, più la frase si illumina.
 */
export default function Costellazione({ frase, parole, obiettivo, accendiTutto }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dati = useRef({
    punti: [] as Punto[],
    polvere: [] as { x: number; y: number; r: number; f: number }[],
    etichette: [] as Etichetta[],
    viste: new Set<string>(),
    accese: 0,
    w: 0,
    h: 0,
    primoGiro: true,
    posto: 0,
    piena: 0, // ms in cui la frase si è accesa tutta
  });
  const props = useRef({ parole, obiettivo, accendiTutto });
  props.current = { parole, obiettivo, accendiTutto };

  // Disegno e animazione
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const d = dati.current;
    let raf = 0;

    function prepara() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      d.w = w;
      d.h = h;

      // Disegno la frase su una tela nascosta e ne prendo i punti
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const o = off.getContext("2d")!;
      let size = h * 0.34;
      o.font = `700 ${size}px Inter, system-ui, sans-serif`;
      const larg = o.measureText(frase).width;
      if (larg > w * 0.88) size *= (w * 0.88) / larg;
      o.font = `700 ${size}px Inter, system-ui, sans-serif`;
      o.textAlign = "center";
      o.textBaseline = "middle";
      o.fillStyle = "#fff";
      o.fillText(frase, w / 2, h * 0.46);
      const img = o.getImageData(0, 0, w, h).data;
      const passo = Math.max(5, Math.round(size / 13));
      const r = rng(7);
      const nuovi: Punto[] = [];
      for (let y = 0; y < h; y += passo) {
        for (let x = 0; x < w; x += passo) {
          if (img[(y * w + x) * 4 + 3] > 140) {
            nuovi.push({
              x: x + (r() - 0.5) * passo * 0.5,
              y: y + (r() - 0.5) * passo * 0.5,
              da: { x: w / 2, y: h },
              accesa: Infinity,
              fase: r() * Math.PI * 2,
            });
          }
        }
      }
      // ordine casuale ma stabile: la frase si accende a pezzi sparsi
      for (let i = nuovi.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [nuovi[i], nuovi[j]] = [nuovi[j], nuovi[i]];
      }
      // tengo accese quelle già accese
      for (let i = 0; i < Math.min(d.accese, nuovi.length); i++) nuovi[i].accesa = 0;
      d.punti = nuovi;
      d.polvere = Array.from({ length: 140 }, () => ({ x: r() * w, y: r() * h, r: r() * 1.3 + 0.3, f: r() * 6 }));
    }

    function aggiorna(now: number) {
      const { parole, obiettivo, accendiTutto } = props.current;
      const T = d.punti.length;
      if (!T) return;
      // nuove parole → etichette che salgono
      const nuove = parole.filter((p) => !d.viste.has(p.id));
      for (const p of nuove) d.viste.add(p.id);
      const perParola = T / Math.max(1, obiettivo);
      const obiettivoAccese = accendiTutto ? T : Math.min(T, Math.round(parole.length * perParola));

      if (obiettivoAccese > d.accese) {
        const daAccendere = obiettivoAccese - d.accese;
        if (d.primoGiro) {
          for (let i = d.accese; i < obiettivoAccese; i++) d.punti[i].accesa = 0;
        } else {
          // ogni parola nuova parte da un punto diverso in basso
          // le parole arrivate insieme si mettono in colonne e righe, senza sovrapporsi
          // (si parte da un quarto dello schermo: a sinistra in basso c'è il QR)
          const sorgenti = (nuove.length ? nuove : [{ id: "tutto", parola: "" }]).map((p, k, arr) => {
            // posto a rotazione: anche parole arrivate una alla volta non finiscono una sopra l'altra
            const posto = d.posto++;
            const col = (posto * 3) % 4; // salta di colonna in colonna, non da sinistra a destra
            const riga = Math.floor(posto / 4) % 2;
            const colonne = arr.length === 1 && !p.parola ? 1 : 4;
            const x = d.w * (0.27 + 0.6 * ((col + 0.5) / colonne));
            const y = d.h * (0.68 + riga * 0.09);
            if (p.parola) d.etichette.push({ testo: p.parola, x, y, nata: now + k * 450 });
            return { x, y, ritardo: k * 450 };
          });
          for (let i = 0; i < daAccendere; i++) {
            const s = sorgenti[Math.floor((i / daAccendere) * sorgenti.length)];
            const p = d.punti[d.accese + i];
            p.da = { x: s.x, y: s.y };
            p.accesa = now + s.ritardo + (accendiTutto && !nuove.length ? i * 6 : (i % 20) * 35);
          }
        }
        d.accese = obiettivoAccese;
        if (d.accese >= T && !d.piena) d.piena = d.primoGiro ? 1 : now + VOLO_MS;
      } else if (!d.primoGiro && nuove.length) {
        // frase già piena: le parole compaiono lo stesso
        nuove.forEach((p, k) =>
          d.etichette.push({ testo: p.parola, x: d.w * (0.2 + Math.random() * 0.6), y: d.h * 0.86, nata: now + k * 260 })
        );
      } else if (obiettivoAccese < d.accese && parole.length === 0 && !accendiTutto) {
        // dopo un "azzera": si spegne tutto
        d.punti.forEach((p) => (p.accesa = Infinity));
        d.accese = 0;
        d.piena = 0;
        d.viste = new Set(parole.map((p) => p.id));
      }
      d.primoGiro = false;
    }

    function disegna(now: number) {
      aggiorna(now);
      const { w, h } = d;
      ctx.clearRect(0, 0, w, h);

      // polvere di stelle sullo sfondo
      for (const s of d.polvere) {
        ctx.globalAlpha = 0.18 + 0.18 * Math.sin(now / 900 + s.f);
        ctx.fillStyle = "#cfe0ff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      const piena = d.piena && now > d.piena;
      const respiro = piena ? 0.5 + 0.5 * Math.sin((now - d.piena) / 700) : 0;
      const raggio = Math.max(1.6, Math.min(w, h) / 260);

      // sagoma spenta della frase
      ctx.fillStyle = "#8FACFF";
      ctx.globalAlpha = 0.07;
      for (const p of d.punti) {
        if (now >= p.accesa + VOLO_MS) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, raggio * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      // stelle accese e in volo
      for (const p of d.punti) {
        if (now < p.accesa) continue;
        const t = Math.min(1, (now - p.accesa) / VOLO_MS);
        const e = easeOut(t);
        const x = p.da.x + (p.x - p.da.x) * e;
        const y = p.da.y + (p.y - p.da.y) * e - Math.sin(e * Math.PI) * h * 0.08;
        const brillio = 0.75 + 0.25 * Math.sin(now / 500 + p.fase);
        const r = raggio * (t < 1 ? 1.6 - 0.6 * e : 1 + 0.35 * respiro) * brillio;

        if (t < 1) {
          // scia
          ctx.globalAlpha = 0.35 * (1 - e);
          ctx.strokeStyle = "#FFD666";
          ctx.lineWidth = r * 0.9;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - (p.x - p.da.x) * 0.06, y - (p.y - p.da.y) * 0.06 + h * 0.01);
          ctx.stroke();
        }
        // alone
        ctx.globalAlpha = 0.16 + 0.16 * respiro;
        ctx.fillStyle = "#FFD666";
        ctx.beginPath();
        ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
        ctx.fill();
        // nucleo
        ctx.globalAlpha = 1;
        ctx.fillStyle = t < 1 ? "#ffffff" : "#FFE9A8";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // parole che salgono e svaniscono
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fs = Math.max(18, Math.min(w, h) / 22);
      ctx.font = `600 ${fs}px Fraunces, Georgia, serif`;
      d.etichette = d.etichette.filter((l) => now - l.nata < ETICHETTA_MS);
      for (const l of d.etichette) {
        const t = (now - l.nata) / ETICHETTA_MS;
        if (t < 0) continue;
        const a = t < 0.12 ? t / 0.12 : t > 0.6 ? Math.max(0, 1 - (t - 0.6) / 0.4) : 1;
        ctx.globalAlpha = a;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(l.testo, l.x, l.y - easeOut(Math.min(1, t * 1.4)) * h * 0.05);
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(disegna);
    }

    prepara();
    raf = requestAnimationFrame(disegna);
    const onResize = () => prepara();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [frase]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label={`La parola ${frase} fatta di stelle`} />;
}
