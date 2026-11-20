-- Esquema propuesto para Supabase (etapa futura). NO se ejecuta en esta etapa.
-- Refleja el modelo de src/domain/types.ts con Row Level Security por usuario.

create table if not exists public.categories (
  id text primary key,
  user_id uuid references auth.users on delete cascade, -- null = categoría del sistema
  label text not null,
  icon text not null default 'tag',
  color text not null default 'neutral',
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  description text not null default '' check (char_length(description) <= 2000),
  category_id text not null,
  date date,
  time time,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'pending' check (status in ('pending','in_progress','done')),
  reminder_minutes_before integer check (reminder_minutes_before >= 0),
  amount bigint check (amount >= 0),
  direction text check (direction in ('pay','collect')),
  due_date date,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists items_user_date on public.items (user_id, date);
create index if not exists items_user_status on public.items (user_id, status);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user','assistant')),
  text text not null,
  outcomes jsonb,
  quick_replies jsonb,
  created_at timestamptz not null default now()
);

alter table public.items enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.categories enable row level security;

create policy "items propios" on public.items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "conversaciones propias" on public.conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mensajes propios" on public.messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categorias visibles" on public.categories for select using (user_id is null or auth.uid() = user_id);
create policy "categorias propias" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
