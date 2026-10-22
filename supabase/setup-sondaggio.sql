-- Nova Severi: tabella per il sondaggio "Più ricreazione" (cortile o 5 minuti in più).
-- Da incollare UNA volta in Supabase -> SQL Editor -> New query -> Run.
-- Non tocca le altre tabelle.

create table if not exists public.ricreazione_voti (
  id uuid primary key default gen_random_uuid(),
  scelta text not null check (scelta in ('cortile', 'minuti')),
  device_hash text not null unique,
  created_at timestamptz not null default now()
);

-- Nessuno legge o scrive direttamente dal browser: passa tutto da /api/sondaggio.
alter table public.ricreazione_voti enable row level security;
