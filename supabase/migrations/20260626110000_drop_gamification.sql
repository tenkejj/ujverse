-- =====================================================================
-- UJverse — DROP gamification (revert migracji 20260626100000)
-- =====================================================================
-- Po krótkiej deliberacji właściciel produktu uznał levele/XP/streak za
-- over-engineering. Wycofujemy CAŁY gamification stack, ale ZOSTAWIAMY
-- `profiles.onboarding_completed_at` / `onboarding_skipped_at` —
-- interaktywny tour pierwszaka żyje dalej (bez nagród XP).
--
-- Bezpiecznie wgrać:
--   • niezależnie czy poprzednia migracja była zaaplikowana — wszystkie
--     `drop ... if exists`,
--   • cascade rozwiązuje FK z user_achievements → achievements_catalog
--     i user_progress → profiles (gdy istnieją).
--
-- Realtime publication: alter publication ... drop nie wybucha jeśli
-- tabela nie była dodana — owrapowane w do$$ guardem na pg_publication_tables.
-- =====================================================================

-- 1. Usuń tabele Realtime z publication (musi być przed drop tabel, bo
--    pg_publication_tables sięga do pg_class).
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'user_progress'
  ) then
    alter publication supabase_realtime drop table public.user_progress;
  end if;
exception when others then
  null;
end$$;

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'user_achievements'
  ) then
    alter publication supabase_realtime drop table public.user_achievements;
  end if;
exception when others then
  null;
end$$;

-- 2. Drop RPC.
drop function if exists public.award_xp(uuid, text, integer, text);
drop function if exists public.update_streak(uuid);
drop function if exists public.unlock_achievement(uuid, text);
drop function if exists public.get_user_progress(uuid);

-- 3. Drop tabel (cascade — pociągnie indeksy, policy, FK).
drop table if exists public.user_achievements cascade;
drop table if exists public.xp_events cascade;
drop table if exists public.user_progress cascade;
drop table if exists public.achievements_catalog cascade;

-- 4. Onboarding flags na profiles ZOSTAJĄ (potrzebne dla OnboardingTour).
--    Nic nie ruszamy w `profiles`.
