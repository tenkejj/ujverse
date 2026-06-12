-- =====================================================================
-- UJverse — Onboarding + Gamification (XP, levels, streaks, achievements)
-- =====================================================================
-- Cel: utrzymać retention pierwszaków. Idealnie po 7 dniach mają streak,
-- po 30 — level 3+, garstkę odznak, są emocjonalnie przywiązani.
--
-- Wprowadzamy:
--   1. profiles.onboarding_completed_at / onboarding_skipped_at
--   2. user_progress      — XP / level / streak per user (1:1)
--   3. achievements_catalog — słownik odznak (seed w tej migracji)
--   4. user_achievements  — unlock per user (PK = user_id + key)
--   5. xp_events          — append-only audit + IDEMPOTENCJA przez
--      unique (user_id, event_type, coalesce(ref_id,''))
--   6. RPCs: award_xp / update_streak / unlock_achievement /
--      get_user_progress / get_user_progress_public
--
-- Konwencje (jak reszta projektu):
--   • Wszystko z RLS ENABLED. Mutacje wyłącznie przez SECURITY DEFINER RPC
--     (frontend NIGDY nie pisze bezpośrednio do user_progress / xp_events).
--   • SELECT na user_progress / user_achievements jest *public* dla
--     authenticated (level + odznaki widoczne na cudzym profilu — to celowy
--     mechanizm social proof; gdyby user chciał ukryć, dodamy
--     profiles.show_progress jako kolejny migracja).
--   • Level formula: floor(sqrt(total_xp / 100)) + 1. L1=0–99, L2=100–399,
--     L3=400–899, L4=900–1599, L5=1600–2499 ... gentle progression żeby
--     "level up" pojawiał się raz na ~tydzień aktywnego użytkowania.
--   • Realtime publication: tylko user_progress + user_achievements
--     (xp_events pominięte — channel by się zalał przy każdej wiadomości).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. profiles — onboarding flags
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_skipped_at timestamptz;

comment on column public.profiles.onboarding_completed_at is
  'Timestamp ukończenia interaktywnego onboardingu pierwszaka.';
comment on column public.profiles.onboarding_skipped_at is
  'Timestamp gdy user wybrał "Pomiń tour" — nie pokazujemy ponownie auto.';

-- ---------------------------------------------------------------------
-- 2. user_progress — 1:1 z user (XP / level / streak)
-- ---------------------------------------------------------------------
create table if not exists public.user_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total_xp integer not null default 0 check (total_xp >= 0),
  level integer not null default 1 check (level >= 1),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  -- Date (nie timestamptz) — streak liczymy w dniach kalendarzowych UTC.
  -- Jeśli kiedyś chcemy zone'y per-user → przerzucamy do timestamptz +
  -- profiles.timezone (poza scope tej migracji).
  last_login_date date,
  updated_at timestamptz not null default now()
);

create index if not exists user_progress_total_xp_idx
  on public.user_progress (total_xp desc);

alter table public.user_progress enable row level security;

-- SELECT public dla authenticated (social proof na profile).
create policy "user_progress_select_auth" on public.user_progress
  for select to authenticated using (true);

-- INSERT/UPDATE/DELETE → tylko przez SECURITY DEFINER RPC (brak policy).

comment on table public.user_progress is
  'XP / level / streak per user. Mutacje wyłącznie przez RPC award_xp / update_streak.';

-- ---------------------------------------------------------------------
-- 3. achievements_catalog — słownik odznak
-- ---------------------------------------------------------------------
create table if not exists public.achievements_catalog (
  key text primary key,
  name text not null,
  description text not null,
  xp_reward integer not null default 0 check (xp_reward >= 0),
  -- lucide-react icon name (np 'sparkles', 'flame', 'trophy')
  icon_name text not null,
  rarity text not null default 'common'
    check (rarity in ('common', 'rare', 'epic', 'legendary')),
  -- Kategoria do grupowania w UI ("aula", "social", "exploration"...).
  category text not null default 'general',
  -- Order w UI (rosnąco). Achievementy "łatwiejsze" mniejszy sort_order.
  sort_order integer not null default 0
);

alter table public.achievements_catalog enable row level security;

create policy "achievements_catalog_select_all" on public.achievements_catalog
  for select to authenticated using (true);

comment on table public.achievements_catalog is
  'Słownik odznak. Edycja tylko przez migracje / admin SQL.';

-- ---------------------------------------------------------------------
-- 4. user_achievements — unlock per user
-- ---------------------------------------------------------------------
create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null references public.achievements_catalog(key) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_key)
);

create index if not exists user_achievements_user_idx
  on public.user_achievements (user_id, unlocked_at desc);

alter table public.user_achievements enable row level security;

create policy "user_achievements_select_auth" on public.user_achievements
  for select to authenticated using (true);

-- INSERT przez RPC unlock_achievement (SECURITY DEFINER).

comment on table public.user_achievements is
  'Odblokowane odznaki per user. Unlock przez RPC unlock_achievement (idempotent).';

-- ---------------------------------------------------------------------
-- 5. xp_events — append-only audit + idempotency
-- ---------------------------------------------------------------------
create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  xp_amount integer not null check (xp_amount >= 0),
  /* ref_id = opcjonalny identyfikator obiektu który wygenerował event,
     np. message_id, task_id. Pozwala idempotency: drugie wywołanie
     award_xp dla tego samego (user, type, ref_id) NIE doliczy XP. */
  ref_id text,
  created_at timestamptz not null default now()
);

-- IDEMPOTENCJA: jeden event per (user, type, ref_id). Dla event_type bez
-- ref_id (np. "daily_login") używamy daty w ref_id (YYYY-MM-DD) z poziomu
-- RPC update_streak/award_xp.
create unique index if not exists xp_events_idempotency_idx
  on public.xp_events (user_id, event_type, coalesce(ref_id, ''));

create index if not exists xp_events_user_recent_idx
  on public.xp_events (user_id, created_at desc);

alter table public.xp_events enable row level security;

create policy "xp_events_select_own" on public.xp_events
  for select to authenticated using (auth.uid() = user_id);

-- INSERT przez RPC award_xp.

comment on table public.xp_events is
  'Append-only log naliczeń XP. ref_id wymusza idempotencję per zdarzenie.';

-- =====================================================================
-- 6. RPCs
-- =====================================================================

-- award_xp — idempotent. Zwraca {awarded_xp, new_total_xp, new_level,
-- leveled_up}. Jeśli już naliczone (ten sam ref_id) → awarded_xp = 0.
-- Level formula: floor(sqrt(total_xp / 100)) + 1.
create or replace function public.award_xp(
  p_user_id uuid,
  p_event_type text,
  p_xp integer,
  p_ref_id text default null
)
returns table(
  awarded_xp integer,
  new_total_xp integer,
  new_level integer,
  leveled_up boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted boolean := false;
  v_old_level integer;
  v_new_level integer;
  v_new_total integer;
begin
  if p_user_id is null or p_event_type is null or p_xp is null or p_xp < 0 then
    raise exception 'award_xp: invalid params';
  end if;

  -- Idempotent insert. unique_violation = już naliczone.
  begin
    insert into xp_events(user_id, event_type, xp_amount, ref_id)
    values (p_user_id, p_event_type, p_xp, p_ref_id);
    v_inserted := true;
  exception when unique_violation then
    v_inserted := false;
  end;

  if not v_inserted then
    select up.total_xp, up.level
      into v_new_total, v_new_level
    from user_progress up
    where up.user_id = p_user_id;
    return query select 0, coalesce(v_new_total, 0), coalesce(v_new_level, 1), false;
    return;
  end if;

  -- Upsert user_progress (atomic, RETURNING level *przed* update).
  insert into user_progress(user_id, total_xp, level)
  values (p_user_id, p_xp, 1)
  on conflict (user_id) do update
    set total_xp = user_progress.total_xp + excluded.total_xp,
        updated_at = now()
  returning user_progress.level into v_old_level;

  select up.total_xp into v_new_total
  from user_progress up where up.user_id = p_user_id;

  v_new_level := floor(sqrt(v_new_total / 100.0))::integer + 1;
  if v_new_level < 1 then v_new_level := 1; end if;

  if v_new_level <> v_old_level then
    update user_progress
       set level = v_new_level
     where user_id = p_user_id;
  end if;

  return query select p_xp, v_new_total, v_new_level, v_new_level > v_old_level;
end;
$$;

grant execute on function public.award_xp(uuid, text, integer, text) to authenticated;

comment on function public.award_xp(uuid, text, integer, text) is
  'Idempotent naliczanie XP. Drugie wywołanie z tym samym (user,type,ref_id) = no-op.';

-- update_streak — wywoływane raz dziennie przy logowaniu / wejściu w app.
-- Logika:
--   • brak last_login_date → streak = 1
--   • last_login_date = today → no-op (juz dzisiaj)
--   • last_login_date = today-1 → streak += 1
--   • inaczej → streak = 1 (zerwany)
-- Zwraca {new_streak, was_extended}.
create or replace function public.update_streak(p_user_id uuid)
returns table(
  new_streak integer,
  longest_streak integer,
  was_extended boolean,
  already_today boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
  v_last_date date;
  v_streak integer;
  v_longest integer;
  v_extended boolean := false;
  v_already boolean := false;
begin
  if p_user_id is null then
    raise exception 'update_streak: user_id is null';
  end if;

  insert into user_progress(user_id) values (p_user_id) on conflict do nothing;

  select last_login_date, current_streak, user_progress.longest_streak
    into v_last_date, v_streak, v_longest
  from user_progress
  where user_id = p_user_id;

  if v_last_date is null then
    v_streak := 1;
    v_extended := true;
  elsif v_last_date = v_today then
    v_already := true;
  elsif v_last_date = v_today - interval '1 day' then
    v_streak := v_streak + 1;
    v_extended := true;
  else
    v_streak := 1;
    v_extended := true;
  end if;

  v_longest := greatest(v_longest, v_streak);

  if not v_already then
    update user_progress
       set current_streak = v_streak,
           longest_streak = v_longest,
           last_login_date = v_today,
           updated_at = now()
     where user_id = p_user_id;

    -- Daily login XP (idempotent przez ref_id = data ISO).
    perform award_xp(p_user_id, 'daily_login', 5, v_today::text);

    -- Streak milestones — unlock przy 3 / 7 / 30 dniach.
    if v_streak = 3 then
      perform unlock_achievement(p_user_id, 'streak_3');
    elsif v_streak = 7 then
      perform unlock_achievement(p_user_id, 'streak_7');
    elsif v_streak = 30 then
      perform unlock_achievement(p_user_id, 'streak_30');
    end if;
  end if;

  return query select v_streak, v_longest, v_extended, v_already;
end;
$$;

grant execute on function public.update_streak(uuid) to authenticated;

comment on function public.update_streak(uuid) is
  'Wywoływane raz przy wejściu w app. Aktualizuje streak + nalicza daily_login XP.';

-- unlock_achievement — idempotent. Zwraca true jeśli nowo odblokowane.
create or replace function public.unlock_achievement(
  p_user_id uuid,
  p_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_xp integer;
  v_inserted boolean := false;
begin
  if p_user_id is null or p_key is null then
    raise exception 'unlock_achievement: invalid params';
  end if;

  -- Walidacja, że achievement istnieje w katalogu.
  select xp_reward into v_xp
  from achievements_catalog where key = p_key;
  if not found then
    raise exception 'unlock_achievement: unknown key %', p_key;
  end if;

  insert into user_achievements(user_id, achievement_key)
  values (p_user_id, p_key)
  on conflict (user_id, achievement_key) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted then
    if v_xp > 0 then
      perform award_xp(p_user_id, 'achievement_' || p_key, v_xp, p_key);
    end if;
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.unlock_achievement(uuid, text) to authenticated;

comment on function public.unlock_achievement(uuid, text) is
  'Idempotent unlock odznaki + auto-award XP z catalog.xp_reward.';

-- get_user_progress — kompletny JSON {progress, achievements[]}.
create or replace function public.get_user_progress(p_user_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'progress', coalesce(
      (
        select to_jsonb(up.*)
        from user_progress up
        where up.user_id = p_user_id
      ),
      jsonb_build_object(
        'user_id', p_user_id,
        'total_xp', 0,
        'level', 1,
        'current_streak', 0,
        'longest_streak', 0,
        'last_login_date', null
      )
    ),
    'achievements', coalesce(
      (
        select json_agg(
          json_build_object(
            'key', ua.achievement_key,
            'unlocked_at', ua.unlocked_at,
            'name', ac.name,
            'description', ac.description,
            'icon_name', ac.icon_name,
            'rarity', ac.rarity,
            'category', ac.category,
            'xp_reward', ac.xp_reward
          )
          order by ua.unlocked_at desc
        )
        from user_achievements ua
        join achievements_catalog ac on ac.key = ua.achievement_key
        where ua.user_id = p_user_id
      ),
      '[]'::json
    )
  );
$$;

grant execute on function public.get_user_progress(uuid) to authenticated;

-- =====================================================================
-- 7. Seed achievements_catalog
-- =====================================================================

insert into public.achievements_catalog
  (key, name, description, xp_reward, icon_name, rarity, category, sort_order)
values
  -- Onboarding
  ('welcome_aboard', 'Witaj na pokładzie!', 'Pierwsze logowanie w UJverse.', 20, 'sparkles', 'common', 'onboarding', 1),
  ('profile_complete', 'Pełen profil', 'Uzupełniłeś wszystkie pola profilu.', 30, 'user-check', 'common', 'onboarding', 2),
  ('onboarding_done', 'Wtajemniczony', 'Ukończyłeś interaktywny tour po UJverse.', 25, 'compass', 'common', 'onboarding', 3),

  -- Streak (sticky retention)
  ('streak_3', 'Trzy dni z rzędu', 'Logujesz się 3 dni z rzędu.', 30, 'flame', 'common', 'streak', 10),
  ('streak_7', 'Tydzień bez przerwy', 'Streak 7 dni — solid.', 100, 'flame', 'rare', 'streak', 11),
  ('streak_30', 'Miesiąc z UJverse', 'Streak 30 dni. Jesteś legendą.', 500, 'crown', 'legendary', 'streak', 12),

  -- Aula (social activity)
  ('first_message', 'Pierwsze słowo', 'Wysłałeś pierwszą wiadomość w Auli.', 25, 'message-circle', 'common', 'aula', 20),
  ('aula_starter', 'Aktywny student', '10 wiadomości w Auli — czat ożył.', 50, 'messages-square', 'common', 'aula', 21),
  ('aula_legend', 'Legenda Auli', '100 wiadomości. Twój rocznik Cię kocha.', 200, 'trophy', 'epic', 'aula', 22),
  ('voice_speaker', 'Głos w sieci', 'Wysłałeś pierwszą głosówkę w Auli.', 20, 'mic', 'common', 'aula', 23),
  ('poll_creator', 'Demokrata', 'Stworzyłeś pierwszą ankietę.', 25, 'bar-chart-3', 'common', 'aula', 24),
  ('note_taker', 'Notujący', 'Edytowałeś wspólne notatki sali.', 30, 'sticky-note', 'common', 'aula', 25),

  -- Tasks (productivity)
  ('task_first', 'Pierwsze zadanie', 'Dodałeś pierwsze zadanie/deadline.', 20, 'check-square', 'common', 'tasks', 30),
  ('task_done_first', 'Robota wykonana', 'Ukończyłeś pierwsze zadanie.', 15, 'check-circle-2', 'common', 'tasks', 31),
  ('task_master', 'Mistrz zadań', 'Ukończyłeś 10 zadań w Auli.', 100, 'target', 'rare', 'tasks', 32),

  -- Couponek (community contribution)
  ('discount_finder', 'Pierwsza zniżka', 'Dodałeś zniżkę do Couponka.', 40, 'ticket', 'common', 'community', 40),
  ('discount_hero', 'Bohater zniżek', 'Dodałeś 5 zniżek. Rocznik Ci dziękuje.', 150, 'tags', 'epic', 'community', 41),

  -- Social
  ('social_butterfly', 'Otwarty na ludzi', 'Masz 5 followersów.', 50, 'users', 'rare', 'social', 50),
  ('lecturer_subscriber', 'Słuchacz', 'Zasubskrybowałeś 5 wykładowców.', 30, 'bell', 'common', 'social', 51),
  ('helpful', 'Pomocna dłoń', 'Dostałeś 10 reakcji na swoich wiadomościach.', 75, 'heart', 'rare', 'social', 52),

  -- Exploration
  ('ai_curious', 'AI Ciekawski', 'Pierwsze użycie AI Assistant.', 20, 'sparkles', 'common', 'exploration', 60),
  ('early_adopter', 'Wczesna ptaszyna', 'Dołączyłeś w pierwszym tygodniu uruchomienia gamification.', 100, 'sunrise', 'rare', 'exploration', 61)
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description,
      xp_reward = excluded.xp_reward,
      icon_name = excluded.icon_name,
      rarity = excluded.rarity,
      category = excluded.category,
      sort_order = excluded.sort_order;

-- =====================================================================
-- 8. Realtime publication
-- =====================================================================
-- user_progress + user_achievements idą do Realtime — front subskrybuje
-- na own user_id i pokazuje toasty / podświetla nowe achievementy.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'user_progress'
  ) then
    alter publication supabase_realtime add table public.user_progress;
  end if;
exception when others then
  -- Publication może nie istnieć w lokalnej devce — graceful skip.
  null;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'user_achievements'
  ) then
    alter publication supabase_realtime add table public.user_achievements;
  end if;
exception when others then
  null;
end$$;
