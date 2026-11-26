-- Nova Severi: tabelle per i giochi dell'assemblea ("Accendi una stella" e "Indovina l'anno").
-- Da incollare UNA volta in Supabase -> SQL Editor -> New query -> Run.
-- Non tocca le altre tabelle.

-- Lo stato della sala (che gioco è sullo schermo, quale domanda, ecc.): una riga sola.
create table if not exists public.assemblea_stato (
  id smallint primary key default 1 check (id = 1),
  dati jsonb not null default '{}'::jsonb,
  aggiornato timestamptz not null default now()
);
insert into public.assemblea_stato (id, dati) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- Le parole mandate dai telefoni: restano "attesa" finché la regia non le approva.
create table if not exists public.assemblea_parole (
  id uuid primary key default gen_random_uuid(),
  parola text not null check (char_length(parola) between 1 and 24),
  stato text not null default 'attesa' check (stato in ('attesa', 'ok', 'no')),
  device_hash text unique,
  created_at timestamptz not null default now()
);

-- Le risposte del quiz: una per telefono per domanda.
create table if not exists public.assemblea_risposte (
  id uuid primary key default gen_random_uuid(),
  domanda smallint not null,
  anno smallint not null check (anno between 1800 and 2100),
  classe text not null check (char_length(classe) <= 4),
  device_hash text not null,
  created_at timestamptz not null default now(),
  unique (domanda, device_hash)
);

-- Nessuno legge o scrive direttamente dal browser: passa tutto da /api/assemblea.
alter table public.assemblea_stato enable row level security;
alter table public.assemblea_parole enable row level security;
alter table public.assemblea_risposte enable row level security;
