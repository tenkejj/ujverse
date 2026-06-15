-- Migration: chat feedback (kciuk gora / kciuk dol pod assistant message).
--
-- Cel:
--  - dataset do iteracji jakosci persony / synthesizera
--  - dashboard ktore toole sa zle oceniane (regres detection)
--  - sygnal dla cache / circuit breaker (zle odpowiedzi nie ida do cache)
--
-- Architektura:
--  - 1 wiersz = 1 ocena (kciuk gora/dol) per usera per assistant message.
--  - `message_id` jest stringiem z RAM-u klienta (`useChatStore.addMessage`
--    generuje uuid lub fallback `msg_<base36>`). Nie wiazemy z `messages`
--    bo czat AI jest efemeryczny — nigdy nie zapisujemy historii do bazy.
--  - `tool` opcjonalny — gdy user ocenia odpowiedz fast-path / tool-call,
--    zapisujemy nazwe toola, zeby dashboard mogl pokazac per-tool stats.
--  - `note` opcjonalny — user moze dorzucic feedback tekstowy (max 1000ch).
--  - Update przez `ON CONFLICT (user_id, message_id) DO UPDATE` — drugi
--    klik (np. zmiana z UP na DOWN) nadpisuje, nie tworzy duplicate.

create extension if not exists "pgcrypto";

create table if not exists public.chat_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id text not null,
  tool text,
  rating text not null check (rating in ('up', 'down')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Jeden wiersz per (user, message). Drugi klik nadpisuje przez upsert.
  constraint chat_feedback_user_message_uq unique (user_id, message_id),

  -- Safety limit na free-text feedback.
  constraint chat_feedback_note_max_len check (note is null or length(note) <= 1000)
);

-- Indexy:
--  - lookup po userze (kasowanie konta, audyt) — pokrywa `user_id`
--    przez unique constraint, ale lepszy explicit hint dla query plannera.
--  - dashboard admina: per-tool / per-rating, sortowane po dacie.
create index if not exists chat_feedback_user_id_idx
  on public.chat_feedback (user_id);
create index if not exists chat_feedback_tool_created_idx
  on public.chat_feedback (tool, created_at desc)
  where tool is not null;
create index if not exists chat_feedback_rating_created_idx
  on public.chat_feedback (rating, created_at desc);

-- Trigger updated_at na update (drugi klik / zmiana noty).
create or replace function public.tg_chat_feedback_set_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists chat_feedback_set_updated on public.chat_feedback;
create trigger chat_feedback_set_updated
  before update on public.chat_feedback
  for each row execute function public.tg_chat_feedback_set_updated();

-- RLS:
--  - SELECT: kazdy user widzi WLASNE oceny + admin (`is_profile_admin()`)
--    widzi wszystko (dashboard).
--  - INSERT / UPDATE: tylko wlasne oceny, w roli `authenticated`.
--    Anon nie moze ocenic — to chronione na poziomie API (endpoint
--    odrzuca brak JWT), RLS to belt-and-suspenders.
--  - DELETE: tylko wlasne (user moze cofnac), admin tez moze (moderacja).
alter table public.chat_feedback enable row level security;

drop policy if exists chat_feedback_select_own_or_admin on public.chat_feedback;
create policy chat_feedback_select_own_or_admin
  on public.chat_feedback
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_profile_admin());

drop policy if exists chat_feedback_insert_own on public.chat_feedback;
create policy chat_feedback_insert_own
  on public.chat_feedback
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists chat_feedback_update_own on public.chat_feedback;
create policy chat_feedback_update_own
  on public.chat_feedback
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists chat_feedback_delete_own_or_admin on public.chat_feedback;
create policy chat_feedback_delete_own_or_admin
  on public.chat_feedback
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_profile_admin());

comment on table public.chat_feedback is
  'Kciuk gora / dol oceny assistant message w czacie AI. 1 wiersz per (user, message). Adminowi widoczne dla dashboardu jakosci.';
