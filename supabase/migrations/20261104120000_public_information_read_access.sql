-- =====================================================================
-- UJverse — publiczny odczyt informacji uczelnianych (pivot: hub informacyjny)
-- =====================================================================
-- Cel: odwiedzający bez konta (rola `anon`) może czytać wyłącznie dane
-- przepisane przez scrapery z publicznych stron UJ i USOSweb:
--
--   • official_events     — wydarzenia z uj.edu.pl (cała tabela; zapis
--                           wyłącznie service_role przez api/scrape-uj-events.ts),
--   • usos_registrations  — TYLKO wiersze ze scrapera USOSweb
--                           (`source_usos_tura_id IS NOT NULL`). Wpisy
--                           społeczności i seedy zostają widoczne tylko dla
--                           zalogowanych (polityka usos_registrations_select_auth),
--   • announcements       — komunikaty wydziałowe. Na produkcji odczyt publiczny
--                           już istnieje jako ręcznie dodana polityka
--                           („Allow public read access", rola public), której
--                           nie ma w migracjach. Ta polityka zapisuje ten sam
--                           zamiar w wersjonowanym kontrakcie; obie są
--                           permisywne (OR), więc duplikat niczego nie poszerza.
--
-- Celowo BEZ zmian: profiles, posts, comments, likes, follows, notifications,
-- cohort_*, user_timetable_entries, lecturer_subscriptions,
-- usos_registration_subscriptions, usos_scraper_runs, student_discounts,
-- study_spots, storage. Rola anon nie dostaje żadnej polityki INSERT/UPDATE/
-- DELETE — przy włączonym RLS zapisy pozostają zablokowane.
--
-- Indeksy: zapytania anon korzystają z istniejących indeksów
-- (official_events_date_idx, announcements_dept_created_idx,
-- usos_registrations_opens_idx); tabele są małe, nowych indeksów nie dodajemy.
--
-- Migracja jest addytywna i idempotentna (DROP POLICY IF EXISTS + CREATE).
-- Wycofanie: DROP POLICY dla trzech nazw poniżej.
-- =====================================================================

-- RLS musi być włączony (jest od migracji tworzących tabele — asekuracja).
ALTER TABLE public.official_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usos_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Supabase domyślnie nadaje anon uprawnienia do tabel w schemacie public;
-- jawny GRANT SELECT dokumentuje zamiar i działa też na instancjach bez
-- domyślnych uprawnień. Nie nadajemy niczego poza SELECT.
GRANT SELECT ON public.official_events TO anon;
GRANT SELECT ON public.usos_registrations TO anon;
GRANT SELECT ON public.announcements TO anon;

-- ---------------------------------------------------------------------
-- 1. official_events
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS official_events_select_anon ON public.official_events;
CREATE POLICY official_events_select_anon
  ON public.official_events
  FOR SELECT
  TO anon
  USING (true);

COMMENT ON POLICY official_events_select_anon ON public.official_events IS
  'Pivot 2026-11: publiczny odczyt wydarzeń przepisanych z uj.edu.pl (brak danych osobowych).';

-- ---------------------------------------------------------------------
-- 2. usos_registrations — wyłącznie wiersze ze scrapera USOSweb
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS usos_registrations_select_anon_usosweb ON public.usos_registrations;
CREATE POLICY usos_registrations_select_anon_usosweb
  ON public.usos_registrations
  FOR SELECT
  TO anon
  USING (source_usos_tura_id IS NOT NULL);

COMMENT ON POLICY usos_registrations_select_anon_usosweb ON public.usos_registrations IS
  'Pivot 2026-11: anon widzi tylko rejestracje z publicznego katalogu USOSweb; wpisy społeczności i seedy wymagają logowania.';

-- ---------------------------------------------------------------------
-- 3. announcements
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS announcements_select_anon ON public.announcements;
CREATE POLICY announcements_select_anon
  ON public.announcements
  FOR SELECT
  TO anon
  USING (true);

COMMENT ON POLICY announcements_select_anon ON public.announcements IS
  'Pivot 2026-11: publiczny odczyt komunikatów z oficjalnych stron wydziałów (wersjonowany odpowiednik ręcznej polityki z produkcji).';
