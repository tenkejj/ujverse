-- =====================================================================
-- UJverse — zgłoszenia użytkowników (reports) + panel admina
-- =====================================================================
-- Tabela `public.reports` była używana przez kod (PostCard,
-- CommentItem `.from('reports').insert(...)`), ale nie miała formalnej
-- migracji. Ta migracja:
--
--   1. Tworzy (lub doszczelnia) schemat `reports` z polem `details`
--      (treść od zgłaszającego) i polami workflow admina
--      (`status`, `resolved_by`, `resolved_at`, `resolution_note`).
--   2. Włącza RLS i definiuje polityki:
--        • INSERT → zalogowany user, `reporter_id = auth.uid()`, musi być
--          podane DOKŁADNIE jedno z (`post_id`, `comment_id`).
--        • SELECT → zgłaszający widzi własne zgłoszenia, admin widzi wszystkie.
--        • UPDATE → tylko admin (`is_profile_admin()`) — zmiana statusu,
--          rozwiązanie, dopisanie noty.
--        • DELETE → tylko admin.
--   3. Trigger `reports_set_resolved_at` automatycznie wypełnia
--      `resolved_at` i `resolved_by` przy przejściu do statusu
--      `resolved` / `dismissed`.
--   4. Indeksy pod typowe filtry admina (status × created_at, foreign keys).
--
-- Konwencje spójne z `student_discounts.sql` i `admin_moderation_rls.sql`.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Tabela reports — schemat
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id bigserial primary key,
  reporter_id uuid not null references public.profiles(id) on delete cascade,

  -- target: dokładnie jedno z (post_id, comment_id) — wymusza CHECK niżej
  post_id    bigint references public.posts(id)    on delete cascade,
  comment_id bigint references public.comments(id) on delete cascade,

  reason text not null check (char_length(reason) between 1 and 80),
  created_at timestamptz not null default now()
);

-- Backfill kolumn dla projektów, gdzie tabela powstała ręcznie wcześniej
-- (np. przez Supabase Studio) i nie miała wszystkich pól.
alter table public.reports add column if not exists reporter_id uuid references public.profiles(id) on delete cascade;
alter table public.reports add column if not exists post_id     bigint references public.posts(id)    on delete cascade;
alter table public.reports add column if not exists comment_id  bigint references public.comments(id) on delete cascade;
alter table public.reports add column if not exists reason      text not null default '';
alter table public.reports add column if not exists created_at  timestamptz not null default now();

-- ---------------------------------------------------------------------
-- 2. Pole `details` — treść (notatka) od zgłaszającego
-- ---------------------------------------------------------------------
alter table public.reports
  add column if not exists details text
  check (details is null or char_length(details) <= 1000);

-- ---------------------------------------------------------------------
-- 3. Workflow admina: status + rozwiązanie + nota
-- ---------------------------------------------------------------------
alter table public.reports
  add column if not exists status text not null default 'open';

-- Tabela `reports` istniała w niektórych środowiskach przed tą migracją
-- (kod od dawna wstawiał wiersze przez `.from('reports').insert(...)`),
-- ale BEZ formalnego workflow statusu. Jeśli kolumna `status` została
-- ręcznie założona z innymi wartościami (np. Supabase Studio default,
-- 'pending', 'new', cokolwiek), CHECK niżej by od razu wybuchł
-- (`23514 ... is violated by some row`). Normalizacja przed CHECK-iem:
--   • NULL / nieznana wartość  → 'open'  (najbezpieczniejszy default —
--     i tak wymaga rozpatrzenia przez admina)
--   • case-insensitive match na nasz enum (np. 'OPEN' → 'open')
--   • istniejące poprawne wartości zostają bez zmian
update public.reports
   set status = case lower(coalesce(status, ''))
     when 'open' then 'open'
     when 'reviewing' then 'reviewing'
     when 'resolved' then 'resolved'
     when 'dismissed' then 'dismissed'
     else 'open'
   end
 where status is null
    or status not in ('open', 'reviewing', 'resolved', 'dismissed');

-- CHECK constraint na status jest tworzony w try-catch żeby nie wybuchać
-- przy re-run migracji.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_status_check'
  ) then
    alter table public.reports
      add constraint reports_status_check
      check (status in ('open', 'reviewing', 'resolved', 'dismissed'));
  end if;
end $$;

alter table public.reports
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

alter table public.reports
  add column if not exists resolved_at timestamptz;

alter table public.reports
  add column if not exists resolution_note text
  check (resolution_note is null or char_length(resolution_note) <= 1000);

-- ---------------------------------------------------------------------
-- 4. CHECK: dokładnie jeden target (post LUB comment, nie oba, nie żaden)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_target_xor'
  ) then
    alter table public.reports
      add constraint reports_target_xor
      check (
        (post_id is not null and comment_id is null)
        or (post_id is null and comment_id is not null)
      );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. Indeksy pod panel admina
-- ---------------------------------------------------------------------
create index if not exists reports_status_created_idx
  on public.reports (status, created_at desc);

create index if not exists reports_reporter_idx
  on public.reports (reporter_id);

create index if not exists reports_post_idx
  on public.reports (post_id)
  where post_id is not null;

create index if not exists reports_comment_idx
  on public.reports (comment_id)
  where comment_id is not null;

-- ---------------------------------------------------------------------
-- 6. Trigger: auto-set resolved_at / resolved_by przy zamknięciu
-- ---------------------------------------------------------------------
create or replace function public.reports_set_resolved_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status in ('resolved', 'dismissed')
     and (OLD.status is distinct from NEW.status) then
    NEW.resolved_at := coalesce(NEW.resolved_at, now());
    NEW.resolved_by := coalesce(NEW.resolved_by, auth.uid());
  elsif NEW.status in ('open', 'reviewing') then
    NEW.resolved_at := null;
    NEW.resolved_by := null;
    NEW.resolution_note := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists reports_set_resolved_at_trg on public.reports;
create trigger reports_set_resolved_at_trg
  before update of status on public.reports
  for each row execute function public.reports_set_resolved_at();

-- ---------------------------------------------------------------------
-- 7. RLS — polityki
-- ---------------------------------------------------------------------
alter table public.reports enable row level security;

-- INSERT: każdy zalogowany może zgłosić, ale tylko jako on sam
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
  on public.reports
  for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- SELECT: zgłaszający widzi własne, admin widzi wszystkie
drop policy if exists "reports_select_own_or_admin" on public.reports;
create policy "reports_select_own_or_admin"
  on public.reports
  for select
  to authenticated
  using (auth.uid() = reporter_id or public.is_profile_admin());

-- UPDATE: tylko admin (status, rozwiązanie, nota)
drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin"
  on public.reports
  for update
  to authenticated
  using (public.is_profile_admin())
  with check (public.is_profile_admin());

-- DELETE: tylko admin
drop policy if exists "reports_delete_admin" on public.reports;
create policy "reports_delete_admin"
  on public.reports
  for delete
  to authenticated
  using (public.is_profile_admin());

-- ---------------------------------------------------------------------
-- 8. Komentarze
-- ---------------------------------------------------------------------
comment on table public.reports is
  'Zgłoszenia użytkowników na posty/komentarze. Panel admina pod /admin/reports.';
comment on column public.reports.details is
  'Opcjonalna treść (kontekst) podana przez zgłaszającego w modalu Zgłoś.';
comment on column public.reports.status is
  'open → reviewing → resolved/dismissed. Trigger ustawia resolved_at/resolved_by.';
comment on column public.reports.resolution_note is
  'Notatka admina widoczna w panelu po rozwiązaniu/odrzuceniu zgłoszenia.';
