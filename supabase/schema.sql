-- ═══════════════════════════════════════════════════════════════
-- Mi Asistente · Base de datos en Supabase
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Se puede ejecutar varias veces sin dañar los datos existentes.
-- ═══════════════════════════════════════════════════════════════

-- Registros (tareas, citas, pagos)
create table if not exists public.items (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  description text not null default '' check (char_length(description) <= 2000),
  category_id text not null,
  date date,
  time text check (time is null or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  reminder_minutes_before integer check (reminder_minutes_before between 0 and 43200),
  amount bigint check (amount >= 0),
  direction text check (direction in ('pay', 'collect')),
  due_date date,
  effective_date date generated always as (coalesce(date, due_date)) stored,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists items_user_effective_date on public.items (user_id, effective_date);
create index if not exists items_user_status on public.items (user_id, status);

-- Conversaciones del chat
create table if not exists public.conversations (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id text primary key,
  conversation_id text not null references public.conversations on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  text text not null,
  outcomes jsonb,
  quick_replies jsonb,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation on public.messages (conversation_id, created_at);

-- Seguridad: cada persona solo ve y modifica lo suyo (Row Level Security)
alter table public.items enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "items propios" on public.items;
create policy "items propios" on public.items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "conversaciones propias" on public.conversations;
create policy "conversaciones propias" on public.conversations
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "mensajes propios" on public.messages;
create policy "mensajes propios" on public.messages
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Sincronización en vivo entre dispositivos (Realtime)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'items') then
    alter publication supabase_realtime add table public.items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
