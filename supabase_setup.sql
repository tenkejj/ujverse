-- ═══════════════════════════════════════════════════════════════════════
-- UJverse – migracja bazy danych
-- Uruchom ten plik w Supabase → SQL Editor (jednorazowo)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Tabela profiles ──────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Row Level Security
alter table public.profiles enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_select_all'
  ) then
    create policy "profiles_select_all"
      on public.profiles for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_insert_own'
  ) then
    create policy "profiles_insert_own"
      on public.profiles for insert with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy "profiles_update_own"
      on public.profiles for update using (auth.uid() = id);
  end if;
end $$;

-- ─── 2. Trigger – auto-tworzenie profilu przy rejestracji ────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── 3. Backfill – profil dla istniejących użytkowników ─────────────────────
insert into public.profiles (id, full_name)
select id, split_part(email, '@', 1)
from auth.users
on conflict (id) do nothing;

-- ─── 4. Kolumna user_id w tabeli posts ───────────────────────────────────────
alter table public.posts
  add column if not exists user_id uuid references public.profiles(id) on delete set null;

-- ─── 5. Tabela likes (jeśli nie istnieje) ────────────────────────────────────
create table if not exists public.likes (
  id         bigserial primary key,
  post_id    uuid,           -- typ dostosuj do posts.id jeśli nie-uuid
  user_id    uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.likes enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'likes' and policyname = 'likes_select_all'
  ) then
    create policy "likes_select_all" on public.likes for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'likes' and policyname = 'likes_insert_own'
  ) then
    create policy "likes_insert_own"
      on public.likes for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'likes' and policyname = 'likes_delete_own'
  ) then
    create policy "likes_delete_own"
      on public.likes for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ─── 6. Storage bucket 'media' – upewnij się że istnieje ─────────────────────
-- Jeśli bucket nie istnieje, utwórz go w Supabase → Storage → New bucket
-- Nazwa: media, Public: true
-- Albo odpal poniższe przez API (nie przez SQL):
-- supabase.storage.createBucket('media', { public: true })

-- ═══════════════════════════════════════════════════════════════════════
-- UJverse v2 – mikroblog: tytuł opcjonalny + komentarze
-- Uruchom ten blok w Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 7. Kolumna title – zezwól na NULL (microblog nie wymaga tytułu) ──────────
alter table public.posts
  alter column title drop not null;

alter table public.posts
  alter column title set default null;

-- ─── 8. Tabela comments ───────────────────────────────────────────────────────
create table if not exists public.comments (
  id         bigserial primary key,
  post_id    uuid        not null references public.posts(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  content    text        not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create index if not exists comments_post_id_idx   on public.comments(post_id);
create index if not exists comments_created_at_idx on public.comments(created_at desc);

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'comments' and policyname = 'comments_select_all'
  ) then
    create policy "comments_select_all"
      on public.comments for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'comments' and policyname = 'comments_insert_own'
  ) then
    create policy "comments_insert_own"
      on public.comments for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'comments' and policyname = 'comments_delete_own'
  ) then
    create policy "comments_delete_own"
      on public.comments for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ─── 9. Join profiles do comments (view helper) ───────────────────────────────
-- Supabase automatycznie obsłuży .select('*, profiles(...)') przez FK
-- Brak dodatkowej konfiguracji.

-- ═══════════════════════════════════════════════════════════════════════
-- UJverse v3 – system wydziałów
-- Uruchom ten blok w Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 10. Kolumna department w tabeli profiles ─────────────────────────────────
alter table public.profiles
  add column if not exists department text;

-- ─── 11. Kolumny profilowe (jeśli pominięte w v1) ────────────────────────────
alter table public.profiles add column if not exists bio            text;
alter table public.profiles add column if not exists major          text;
alter table public.profiles add column if not exists year_of_study  text;
alter table public.profiles add column if not exists instagram_url  text;
alter table public.profiles add column if not exists linkedin_url   text;
alter table public.profiles add column if not exists banner_url     text;
