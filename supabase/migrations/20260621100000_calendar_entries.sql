-- Kalendarz akademicki: centralna oś czasu agregująca wpisy z wielu źródeł.
--
-- Filozofia:
--   * Materializowana tabela, nie view — żeby filtry per-zakres-dat trafiały
--     na indeks GiST (`time_range && tstzrange(...)`), a nie skanowały trzech
--     źródłowych tabel w runtime.
--   * Każdy wpis ma DOKŁADNIE JEDEN source (CHECK + częściowe unique indeksy).
--     ON DELETE CASCADE na FK robi gc — usunięcie komunikatu/eventu kasuje
--     odpowiadający wpis kalendarza bez triggera.
--   * Pisanie tylko przez triggery (i scraper przez service_role). Brak polityk
--     INSERT/UPDATE/DELETE dla `authenticated` — wzór z `official_events`.
--
-- Źródła v1:
--   * announcements + Bielik (kolumna `extracted_calendar JSONB`) → kindy
--     'lecturer_absence', 'class_cancelled', 'class_remote', 'class_rescheduled',
--     'duty_change'
--   * official_events (trigger DB)
--
-- Świadomie POZA v1 (follow-up):
--   * `public.events` (community) — schemat nie ma jeszcze migracji w repo
--     (komentarz w 20260512014500_events_public_select_policy.sql). Bez
--     pewności co do typu `id` (UUID vs BIGINT) ani kompletu kolumn nie
--     dodajemy FK ani triggera — żeby nie wywalić migracji na czyjejś
--     instancji. Source kind 'community_event' zostawiamy w CHECK, dodamy
--     trigger w osobnej migracji gdy schemat events jest udokumentowany.
--   * 'free_day' (dni wolne UJ) — celowo pominięte w v1.
--   * 'deadline' (stypendia, zapisy) — faza 2.
--
-- Reuse: `public.lecturer_name_key(TEXT)` z 20260615100000_lecturer_subscriptions.sql
-- (`lecturer_key` generowane STORED → idealne pod O(1) lookup w filtrze
-- „tylko moi wykładowcy" w UI).

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Rozszerzenie announcements: extracted_calendar (Bielik) + audit timestamp
--    Trigger w pkt 4 nasłuchuje zmian tej kolumny i synchronizuje
--    calendar_entries. NULL = ekstrakcja nie wykryła ramki czasowej
--    (lub jeszcze jej nie próbowano).
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS extracted_calendar JSONB,
  ADD COLUMN IF NOT EXISTS extraction_attempted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.announcements.extracted_calendar IS
  'JSON wyciągnięty przez Bielika: {kind, starts_at, ends_at, all_day, location, confidence}. NULL = brak danych czasowych lub ekstrakcja jeszcze nie przeprowadzona. Trigger sync_calendar_from_announcement upsertuje calendar_entries na podstawie tej kolumny.';

COMMENT ON COLUMN public.announcements.extraction_attempted_at IS
  'Kiedy ostatnio scraper próbował wyciągnąć calendar JSON. NULL = nie próbowano. NOT NULL z extracted_calendar = NULL = wynik negatywny (komunikat nie zawiera ramki czasowej, nie próbuj ponownie).';

CREATE INDEX IF NOT EXISTS announcements_extracted_calendar_gin
  ON public.announcements USING GIN (extracted_calendar)
  WHERE extracted_calendar IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Tabela calendar_entries
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.calendar_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Klasyfikacja. Trzymamy 'community_event' i 'free_day'/'deadline' w CHECK,
  -- żeby później dodać źródła bez ALTER TABLE.
  kind TEXT NOT NULL CHECK (kind IN (
    'lecturer_absence',
    'class_cancelled',
    'class_remote',
    'class_rescheduled',
    'duty_change',
    'free_day',
    'official_event',
    'community_event',
    'deadline'
  )),

  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
  description TEXT,

  -- Czas: range bo wiele wpisów wielodniowych (urlop, sesja, święta).
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,

  -- Generated tstzrange + GiST index = O(log n) overlap query w widoku
  -- miesiąca/tygodnia (najczęstszy filtr).
  time_range TSTZRANGE GENERATED ALWAYS AS
    (tstzrange(starts_at, ends_at, '[]')) STORED,

  -- Atrybuty zależne od kind. Wszystkie nullable — nie każdy wpis ma
  -- wykładowcę (np. official_event) lub salę.
  lecturer_name TEXT,
  lecturer_key TEXT GENERATED ALWAYS AS
    (public.lecturer_name_key(lecturer_name)) STORED,
  location TEXT,
  department TEXT,

  -- Backreferences. CASCADE → usunięcie źródła kasuje wpis kalendarza.
  source_announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
  source_official_event_id UUID REFERENCES public.official_events(id) ON DELETE CASCADE,

  -- Audyt
  extracted_by TEXT CHECK (extracted_by IN ('bielik', 'trigger', 'fixture', 'manual')),
  confidence NUMERIC(3,2) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Spójność czasowa
  CONSTRAINT calendar_entries_time_valid CHECK (ends_at >= starts_at),

  -- Dokładnie jedno source (lub żadne, dla fixture/manual)
  CONSTRAINT calendar_entries_one_source CHECK (
    (source_announcement_id IS NOT NULL)::int +
    (source_official_event_id IS NOT NULL)::int <= 1
  )
);

COMMENT ON TABLE public.calendar_entries IS
  'Centralna oś czasu kalendarza akademickiego. Pisane wyłącznie przez triggery (z source-tabel) lub scraper przez service_role. RLS pozwala authenticated tylko SELECT.';

-- Indeksy
CREATE INDEX IF NOT EXISTS calendar_entries_range_gist
  ON public.calendar_entries USING GIST (time_range);

CREATE INDEX IF NOT EXISTS calendar_entries_kind_starts_idx
  ON public.calendar_entries (kind, starts_at DESC);

CREATE INDEX IF NOT EXISTS calendar_entries_lecturer_key_starts_idx
  ON public.calendar_entries (lecturer_key, starts_at DESC)
  WHERE lecturer_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS calendar_entries_department_starts_idx
  ON public.calendar_entries (department, starts_at DESC)
  WHERE department IS NOT NULL;

-- Unique partial indexes — guarantują idempotencję sync triggera (1 wpis
-- kalendarza per 1 wiersz źródłowy). Wymagane też do ON CONFLICT w upsercie.
CREATE UNIQUE INDEX IF NOT EXISTS calendar_entries_source_announcement_unique
  ON public.calendar_entries (source_announcement_id)
  WHERE source_announcement_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS calendar_entries_source_official_event_unique
  ON public.calendar_entries (source_official_event_id)
  WHERE source_official_event_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. RLS — wszyscy zalogowani czytają, nikt nie pisze przez API
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.calendar_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_entries_select_all ON public.calendar_entries;
CREATE POLICY calendar_entries_select_all
  ON public.calendar_entries FOR SELECT
  TO authenticated
  USING (true);

-- Brak polityk INSERT/UPDATE/DELETE dla authenticated — modyfikacje wyłącznie
-- przez triggery (SECURITY DEFINER) i scraper (service_role bypass RLS).
-- Wzór identyczny jak `official_events`.

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Trigger: announcements.extracted_calendar → calendar_entries
--    Strategia delete+insert (zamiast ON CONFLICT) bo czyszczenie
--    extracted_calendar na NULL też ma usunąć wpis kalendarza —
--    jeden code path zamiast dwóch.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_calendar_from_announcement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind TEXT;
  v_starts TIMESTAMPTZ;
  v_ends TIMESTAMPTZ;
  v_all_day BOOLEAN;
  v_location TEXT;
  v_confidence NUMERIC(3,2);
  v_title TEXT;
  v_description TEXT;
BEGIN
  -- Każda zmiana: wywal stary wpis (jeśli był), potem ewentualnie wstaw nowy.
  -- To unika potrzeby porównywania OLD vs NEW.
  DELETE FROM public.calendar_entries
    WHERE source_announcement_id = NEW.id;

  -- Brak ekstrakcji = brak wpisu w kalendarzu (legalne).
  IF NEW.extracted_calendar IS NULL THEN
    RETURN NEW;
  END IF;

  -- Walidacja struktury JSON. Cokolwiek niespodziewanego → no-op
  -- (lepiej zignorować zły JSON niż wywalić INSERT na announcements).
  BEGIN
    v_kind := NEW.extracted_calendar ->> 'kind';
    v_starts := (NEW.extracted_calendar ->> 'starts_at')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF v_kind IS NULL OR v_starts IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_kind NOT IN ('lecturer_absence','class_cancelled','class_remote','class_rescheduled','duty_change') THEN
    RETURN NEW;
  END IF;

  -- ends_at opcjonalne; gdy brak, traktujemy jako punkt czasowy.
  BEGIN
    v_ends := COALESCE((NEW.extracted_calendar ->> 'ends_at')::timestamptz, v_starts);
  EXCEPTION WHEN OTHERS THEN
    v_ends := v_starts;
  END;

  -- Defensywa: jeśli model zwrócił ends < starts, spłaszcz do starts.
  IF v_ends < v_starts THEN
    v_ends := v_starts;
  END IF;

  v_all_day := COALESCE((NEW.extracted_calendar ->> 'all_day')::boolean, FALSE);
  v_location := NULLIF(btrim(NEW.extracted_calendar ->> 'location'), '');

  BEGIN
    v_confidence := (NEW.extracted_calendar ->> 'confidence')::numeric;
    IF v_confidence < 0 OR v_confidence > 1 THEN v_confidence := NULL; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_confidence := NULL;
  END;

  -- Tytuł = krótki nagłówek dla UI. Pełny tekst komunikatu zostaje w
  -- description (pierwsze 280 znaków, reszta dostępna przez source).
  v_title := CASE v_kind
    WHEN 'lecturer_absence'   THEN COALESCE(NEW.lecturer_name, 'Wykładowca') || ' — nieobecność'
    WHEN 'class_cancelled'    THEN COALESCE(NEW.lecturer_name, 'Wykładowca') || ' — zajęcia odwołane'
    WHEN 'class_remote'       THEN COALESCE(NEW.lecturer_name, 'Wykładowca') || ' — zajęcia zdalne'
    WHEN 'class_rescheduled'  THEN COALESCE(NEW.lecturer_name, 'Wykładowca') || ' — zmiana terminu'
    WHEN 'duty_change'        THEN COALESCE(NEW.lecturer_name, 'Wykładowca') || ' — dyżur'
    ELSE 'Komunikat'
  END;

  v_description := CASE
    WHEN length(NEW.body) > 280 THEN substring(NEW.body FROM 1 FOR 280) || '…'
    ELSE NEW.body
  END;

  INSERT INTO public.calendar_entries (
    kind, title, description,
    starts_at, ends_at, all_day,
    lecturer_name, location, department,
    source_announcement_id,
    extracted_by, confidence
  ) VALUES (
    v_kind, v_title, v_description,
    v_starts, v_ends, v_all_day,
    NEW.lecturer_name, v_location, NEW.department,
    NEW.id,
    'bielik', v_confidence
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_calendar_from_announcement() IS
  'Sync announcements.extracted_calendar → calendar_entries. Idempotentny (delete+insert per source_announcement_id).';

DROP TRIGGER IF EXISTS on_announcement_calendar_sync ON public.announcements;
CREATE TRIGGER on_announcement_calendar_sync
  AFTER INSERT OR UPDATE OF extracted_calendar, lecturer_name, body, department
  ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_calendar_from_announcement();

-- ──────────────────────────────────────────────────────────────────────────
-- 5. Trigger: official_events → calendar_entries
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_calendar_from_official_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_description TEXT;
BEGIN
  DELETE FROM public.calendar_entries
    WHERE source_official_event_id = NEW.id;

  IF NEW.title IS NULL OR NEW.date IS NULL THEN
    RETURN NEW;
  END IF;

  v_description := CASE
    WHEN NEW.description IS NULL OR length(NEW.description) = 0 THEN NULL
    WHEN length(NEW.description) > 280 THEN substring(NEW.description FROM 1 FOR 280) || '…'
    ELSE NEW.description
  END;

  INSERT INTO public.calendar_entries (
    kind, title, description,
    starts_at, ends_at, all_day,
    location, department,
    source_official_event_id,
    extracted_by
  ) VALUES (
    'official_event', NEW.title, v_description,
    NEW.date, NEW.date, FALSE,
    NULLIF(btrim(NEW.location), ''), NEW.faculty,
    NEW.id,
    'trigger'
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_calendar_from_official_event() IS
  'Sync official_events → calendar_entries jako kind=''official_event''. Idempotentny.';

DROP TRIGGER IF EXISTS on_official_event_calendar_sync ON public.official_events;
CREATE TRIGGER on_official_event_calendar_sync
  AFTER INSERT OR UPDATE OF title, date, description, location, faculty
  ON public.official_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_calendar_from_official_event();

-- ──────────────────────────────────────────────────────────────────────────
-- 6. Backfill jednorazowy: zassij istniejące official_events
--    (Komunikaty backfillujemy w PR #4 dopiero po napisaniu extractora.)
-- ──────────────────────────────────────────────────────────────────────────

INSERT INTO public.calendar_entries (
  kind, title, description, starts_at, ends_at, all_day,
  location, department, source_official_event_id, extracted_by
)
SELECT
  'official_event',
  oe.title,
  CASE
    WHEN oe.description IS NULL OR length(oe.description) = 0 THEN NULL
    WHEN length(oe.description) > 280 THEN substring(oe.description FROM 1 FOR 280) || '…'
    ELSE oe.description
  END,
  oe.date,
  oe.date,
  FALSE,
  NULLIF(btrim(oe.location), ''),
  oe.faculty,
  oe.id,
  'trigger'
FROM public.official_events oe
WHERE NOT EXISTS (
  SELECT 1 FROM public.calendar_entries ce
  WHERE ce.source_official_event_id = oe.id
);

-- ──────────────────────────────────────────────────────────────────────────
-- 7. RPC calendar_search — pojedynczy round-trip dla widoku miesiąca/tygodnia
--    SECURITY INVOKER → RLS calendar_entries_select_all i tak pozwala
--    authenticated. Index GiST na time_range trafia w `&&`.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.calendar_search(
  p_range_start TIMESTAMPTZ,
  p_range_end   TIMESTAMPTZ,
  p_kinds         TEXT[] DEFAULT NULL,
  p_lecturer_keys TEXT[] DEFAULT NULL,
  p_departments   TEXT[] DEFAULT NULL,
  p_limit         INT    DEFAULT 500
)
RETURNS SETOF public.calendar_entries
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.*
  FROM public.calendar_entries c
  WHERE c.time_range && tstzrange(p_range_start, p_range_end, '[]')
    AND (
      p_kinds IS NULL OR cardinality(p_kinds) = 0
      OR c.kind = ANY (p_kinds)
    )
    AND (
      p_lecturer_keys IS NULL OR cardinality(p_lecturer_keys) = 0
      OR c.lecturer_key = ANY (p_lecturer_keys)
    )
    AND (
      p_departments IS NULL OR cardinality(p_departments) = 0
      OR c.department = ANY (p_departments)
    )
  ORDER BY c.starts_at ASC, c.created_at ASC
  LIMIT GREATEST(1, LEAST(2000, p_limit));
$$;

COMMENT ON FUNCTION public.calendar_search(TIMESTAMPTZ, TIMESTAMPTZ, TEXT[], TEXT[], TEXT[], INT) IS
  'Zwraca wpisy kalendarza przecinające się z zakresem [start, end]. Opcjonalne filtry per kind / lecturer_key / department. NULL lub puste array = bez filtra.';

GRANT EXECUTE ON FUNCTION public.calendar_search(TIMESTAMPTZ, TIMESTAMPTZ, TEXT[], TEXT[], TEXT[], INT)
  TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 8. (Opcjonalnie) Realtime publication
--    Front może chcieć nasłuchiwać INSERT/UPDATE/DELETE na calendar_entries —
--    np. żeby user zobaczył nowy wpis bez refetcha kiedy scraper Bielikiem
--    sparsuje świeży komunikat. Komentarz, nie wykonujemy — `supabase_realtime`
--    publikacja po stronie projektu może być inna; dodaj ręcznie jeśli chcesz:
--
--    ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_entries;
-- ──────────────────────────────────────────────────────────────────────────
