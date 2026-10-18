-- Nova Severi: tabelle per Appunti e Libri usati + spazio per i file.
-- Da incollare UNA volta in Supabase -> SQL Editor -> New query -> Run.
-- Non tocca la tabella "messages" di S.O.S.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 80),
  subject text not null,
  class_year smallint not null check (class_year between 1 and 5),
  teacher text check (char_length(teacher) <= 40),
  description text check (char_length(description) <= 300),
  file_path text not null unique,
  file_name text,
  file_size integer,
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 100),
  author text check (char_length(author) <= 80),
  subject text,
  class_year smallint check (class_year between 1 and 5),
  price numeric(6, 2) not null check (price >= 0 and price <= 200),
  condition text,
  phone text,
  instagram text,
  delete_code_hash text not null,
  created_at timestamptz not null default now(),
  check (phone is not null or instagram is not null)
);

create index if not exists notes_created_at_idx on public.notes (created_at desc);
create index if not exists books_created_at_idx on public.books (created_at desc);

-- Sicurezza: nessuno può leggere o scrivere direttamente dal browser.
-- Passa tutto da /api/hub, che usa la chiave service_role lato server.
alter table public.notes enable row level security;
alter table public.books enable row level security;

-- Spazio per i file degli appunti: lettura pubblica, max 10 MB, solo PDF/JPG/PNG.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('appunti', 'appunti', true, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
