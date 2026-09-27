# S.O.S. Nova Severi

> "La tua voce, senza il tuo nome."

Cassetta delle idee digitale per gli studenti del Liceo Scientifico
Francesco Severi di Frosinone. Una sola pagina: lo studente scrive un
messaggio (senza nome, email o classe) e lo invia in modo anonimo alla
rappresentanza studentesca.

Stack: **React + TypeScript + Tailwind CSS** (Vite) sul frontend, una
funzione API serverless (`/api/messages`) sul backend, con un semplice
storage su file JSON pronto per essere sostituito da un vero database.

---

## 1. Installazione

Richiede [Node.js](https://nodejs.org) 18 o superiore.

```bash
npm install
```

## 2. Avvio in locale

```bash
npm run dev
```

Questo comando avvia **due processi insieme**:

- il frontend Vite su `http://localhost:5173`
- un piccolo server API locale su `http://localhost:8787` (solo per
  sviluppo — in produzione l'API gira come funzione serverless, vedi
  sotto)

Apri `http://localhost:5173` e prova a inviare un messaggio: verrà
salvato in `api/data/messages.json` (creato automaticamente, escluso dal
git).

## 3. Struttura del progetto

```
src/
  components/     Header, Hero, MessageForm, SuccessScreen, Background
  lib/
    validation.ts  regole di validazione condivise (client + server)
    api.ts          chiamata a /api/messages + cooldown anti-spam lato client
  styles/          CSS globale (Tailwind)
  assets/logo.png  logo ufficiale NOVA SEVERI (asset reale, non ricreato)
api/
  messages.ts       endpoint POST /api/messages (adapter per Vercel)
  dev-server.ts     server locale usato solo da `npm run dev`
  lib/
    handleMessage.ts logica dell'endpoint, senza dipendenze da un framework
    store.ts          storage dei messaggi (JSON di default, Supabase pronto)
    rateLimit.ts       rate limiting anti-spam in memoria
  data/messages.json  creato automaticamente in locale (non versionato)
public/logo.png     stessa immagine del logo, servita staticamente
```

## 4. Come funziona il flusso anonimo

Il form invia **solo**:

- `text` — il messaggio
- `category` — categoria facoltativa (proposta, problema, scuola, ecc.)

Non viene mai richiesto o inviato nome, cognome, email, classe,
telefono o un account. L'endpoint API non salva IP, user agent né
cookie identificativi: l'IP viene solo *hashato temporaneamente in
memoria* per il rate limiting anti-spam (vedi `api/lib/rateLimit.ts`)
e non finisce mai nel messaggio salvato né in log persistenti.

Questo rende il sistema anonimo "by design" per come è costruito, ma
**nota bene**: nessun sito può garantire un anonimato assoluto al
100% (un hosting può comunque loggare richieste HTTP a livello
infrastrutturale). Per questo il sito non promette mai un anonimato
"garantito al 100%" — dichiara solo, correttamente, che non vengono
raccolti dati identificativi non necessari.

## 5. Collegare un database vero

Il file `api/data/messages.json` **funziona per test e demo, ma non è
adatto alla produzione**: su molti hosting serverless (Vercel incluso)
il filesystem non è persistente tra un deploy e l'altro.

Prima di andare online con la scuola, collega un database vero. Il
progetto è già pronto per questo: tutta la logica di salvataggio passa
da un'unica interfaccia in `api/lib/store.ts`.

### Opzione consigliata: Supabase (Postgres gestito, piano gratuito)

1. Crea un progetto su [supabase.com](https://supabase.com).
2. Nella sezione SQL Editor, crea la tabella:
   ```sql
   create table messages (
     id uuid primary key default gen_random_uuid(),
     text text not null,
     category text,
     created_at timestamptz not null default now()
   );
   ```
3. Installa il client: `npm install @supabase/supabase-js`
4. In `api/lib/store.ts` trovi già, commentata, una classe
   `SupabaseStore` pronta all'uso: decommentala e collegala in
   `getStore()`.
5. Aggiungi in `.env.local` (locale) e nelle variabili d'ambiente del
   tuo hosting (produzione):
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
   La `SERVICE_ROLE_KEY` è una chiave server-side: non deve **mai**
   comparire nel codice del frontend (`src/`), solo in `api/`.

### Alternative

Lo stesso pattern (implementare `MessageStore.save()`) funziona per:

- **Firebase** (Firestore) — usa `firebase-admin` lato server.
- **PostgreSQL diretto** — usa `pg` o un ORM come Prisma/Drizzle.

## 6. Variabili d'ambiente

Copia `.env.example` in `.env.local` per lo sviluppo, e configura le
stesse variabili nel pannello del tuo hosting per la produzione.
Nessun segreto va mai scritto nel codice sorgente.

## 7. Deploy

Il progetto è pensato per **Vercel** (funziona anche gratis):

1. Pusha il repository su GitHub.
2. Su [vercel.com](https://vercel.com) → "New Project" → importa il
   repository. Vercel riconosce automaticamente Vite e la cartella
   `api/` come funzioni serverless.
3. Aggiungi le variabili d'ambiente (vedi punto 6) nel pannello del
   progetto, se hai collegato un database.
4. Deploy.

Per deployare altrove (Netlify, Cloudflare Pages, un server Node
proprio), il frontend si builda normalmente con `npm run build`
(output in `dist/`); per l'API, adatta solo `api/messages.ts` al
formato richiesto dalla piattaforma — la logica vera vive in
`api/lib/handleMessage.ts`, che non dipende da nessun framework
specifico.

## 8. Sicurezza anti-spam già implementata

- **Rate limiting**: massimo 5 invii al minuto per IP (hashato, mai
  salvato) — vedi `api/lib/rateLimit.ts`.
- **Cooldown lato client**: 30 secondi tra un invio e il successivo
  dallo stesso dispositivo — vedi `src/lib/api.ts`.
- **Validazione e sanitizzazione input**: lunghezza minima/massima del
  messaggio, rimozione di caratteri di controllo, categoria limitata a
  un set predefinito — vedi `src/lib/validation.ts` (usata sia dal
  frontend che dall'API, così le regole sono sempre coerenti).
- **Metodo HTTP limitato**: l'endpoint accetta solo `POST`.

Per una scuola con molto traffico, valuta di aggiungere in futuro un
rate limiting anche a livello di CDN/edge (es. Vercel Firewall o
Cloudflare) e un CAPTCHA invisibile se dovesse comparire spam
automatizzato.

## 9. Personalizzare i colori/testi

- Palette: `tailwind.config.js` → `theme.extend.colors` (`night`,
  `azure`, `gold`, `mist`), derivata dai colori del logo.
- Testi della hero e del form: `src/components/Hero.tsx` e
  `src/components/MessageForm.tsx`.
- Categorie del form: `src/lib/validation.ts` → `CATEGORIES`.

---

Realizzato per la rappresentanza studentesca del Liceo Scientifico
Francesco Severi, Frosinone.
