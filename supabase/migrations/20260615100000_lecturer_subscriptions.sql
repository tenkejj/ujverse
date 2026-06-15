-- Mój Plan: personalne subskrypcje na wykładowcę → notyfikacja przy nowym komunikacie.
--
-- Buduje na public.announcements (20260412120000_announcements.sql) i public.notifications
-- (20260514140000_notifications_table_rls.sql).
--
-- Wzorce zaczerpnięte z poprzednich migracji notyfikacyjnych:
--   * dynamiczny swap CHECK na notifications.type — jak w 20260611200500 / 20260611202000
--   * trigger fan-out po INSERT — jak w handle_cohort_message_mention_notifications
--
-- Scraper (api/scrape-faculty-announcements.ts) używa upsertu z onConflict='body_fingerprint',
-- więc duplikat komunikatu ląduje jako UPDATE i NIE odpala AFTER INSERT triggera —
-- subskrybent nie dostanie spamu przy każdym uruchomieniu crona.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. IMMUTABLE normalizator nazwiska wykładowcy (klucz matchingu + indeksów).
--    Strategia (zero zewn. extensions, działa w GENERATED ALWAYS AS STORED):
--      * lower()
--      * translate() polskich diakrytyków
--      * regexp_replace tytułów: dr / prof / mgr / hab / inz / inż / ks / uj
--      * regexp_replace pozostałych znaków na spację
--      * collapse whitespace + trim
--    Klucz "dr Magdalena Zych" == "magdalena zych", "dr. hab. Magdalena Zych, prof. UJ"
--    również da "magdalena zych" — co pozwala matchować subskrypcję wprowadzoną
--    ręcznie do nazwiska kanonizowanego przez Groq w scraperze.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lecturer_name_key(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            translate(
              lower(coalesce(p_name, '')),
              'ąćęłńóśźż',
              'acelnoszz'
            ),
            '\m(dr|prof|mgr|hab|inz|inż|ks|uj)\.?\M',
            ' ',
            'gi'
          ),
          '[^a-z0-9\s-]',
          ' ',
          'g'
        ),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

COMMENT ON FUNCTION public.lecturer_name_key(TEXT) IS
  'Stabilny klucz wykładowcy (lower + bez polskich diakrytyków + bez tytułów) dla matchingu lecturer_subscriptions <-> announcements.';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Tabela subskrypcji + RLS (każdy widzi/zarządza tylko swoimi)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lecturer_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (length(btrim(display_name)) BETWEEN 2 AND 160),
  -- Klucz wyliczany ze display_name — niemożliwa rozjazd subskrypcji vs. matching.
  lecturer_key TEXT GENERATED ALWAYS AS (public.lecturer_name_key(display_name)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lecturer_subscriptions_user_key_uniq UNIQUE (user_id, lecturer_key)
);

CREATE INDEX IF NOT EXISTS lecturer_subscriptions_key_idx
  ON public.lecturer_subscriptions (lecturer_key);

CREATE INDEX IF NOT EXISTS lecturer_subscriptions_user_idx
  ON public.lecturer_subscriptions (user_id, created_at DESC);

ALTER TABLE public.lecturer_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lecturer_subscriptions_select_own ON public.lecturer_subscriptions;
DROP POLICY IF EXISTS lecturer_subscriptions_insert_own ON public.lecturer_subscriptions;
DROP POLICY IF EXISTS lecturer_subscriptions_delete_own ON public.lecturer_subscriptions;

CREATE POLICY lecturer_subscriptions_select_own
  ON public.lecturer_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY lecturer_subscriptions_insert_own
  ON public.lecturer_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY lecturer_subscriptions_delete_own
  ON public.lecturer_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. notifications: rozszerzenie typu + announcement_id + actor_id NULLABLE
--    (powiadomienie z scrapera nie ma „autora-osoby")
-- ──────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'notifications'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%type%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_allowed
    CHECK (type IN ('like', 'comment', 'reply_aula', 'mention_aula', 'lecturer_announcement'));
END;
$$;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS announcement_id UUID
  REFERENCES public.announcements (id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  ALTER COLUMN actor_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_announcement_idx
  ON public.notifications (announcement_id) WHERE announcement_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Trigger fan-out: nowy komunikat → notyfikacja dla każdego subskrybenta
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_announcement_fanout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := public.lecturer_name_key(NEW.lecturer_name);
  IF v_key IS NULL OR v_key = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, announcement_id)
  SELECT s.user_id, NULL, 'lecturer_announcement', NEW.id
  FROM public.lecturer_subscriptions s
  WHERE s.lecturer_key = v_key;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_announcement_fanout() IS
  'AFTER INSERT na announcements: dla każdego subskrybenta wykładowcy wstawia notyfikację lecturer_announcement. UPDATE nie odpala (upsert na body_fingerprint chroni przed spamem).';

DROP TRIGGER IF EXISTS on_announcement_fanout ON public.announcements;
CREATE TRIGGER on_announcement_fanout
  AFTER INSERT ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_announcement_fanout();

-- ──────────────────────────────────────────────────────────────────────────
-- 5. RPC search_lecturers — autocomplete dla UI subskrybowania
--    Deduplikuje per lecturer_key, jako display wybiera najdłuższą znaną
--    formę (typowo z tytułem). Sortuje po świeżości + częstotliwości.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_lecturers(p_query TEXT DEFAULT '', p_limit INT DEFAULT 20)
RETURNS TABLE (
  lecturer_name TEXT,
  lecturer_key TEXT,
  announcement_count BIGINT,
  latest_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT
      a.lecturer_name AS name,
      public.lecturer_name_key(a.lecturer_name) AS key,
      a.created_at
    FROM public.announcements a
    WHERE a.lecturer_name IS NOT NULL
  ),
  agg AS (
    SELECT
      key,
      (array_agg(name ORDER BY length(name) DESC, name))[1] AS name,
      COUNT(*) AS announcement_count,
      MAX(created_at) AS latest_at
    FROM normalized
    WHERE key IS NOT NULL
    GROUP BY key
  ),
  q AS (
    SELECT public.lecturer_name_key(coalesce(p_query, '')) AS k
  )
  SELECT a.name, a.key, a.announcement_count, a.latest_at
  FROM agg a, q
  WHERE q.k IS NULL OR q.k = '' OR a.key LIKE '%' || q.k || '%'
  ORDER BY a.latest_at DESC NULLS LAST, a.announcement_count DESC
  LIMIT GREATEST(1, LEAST(50, p_limit));
$$;

COMMENT ON FUNCTION public.search_lecturers(TEXT, INT) IS
  'Autocomplete dla subskrypcji: dedup po lecturer_key, kanoniczna nazwa = najdłuższa forma (z tytułem).';

GRANT EXECUTE ON FUNCTION public.search_lecturers(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lecturer_name_key(TEXT) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 6. RPC announcements_for_lecturer_keys — feed dla widoku „Mój Plan"
--    Filtr po znormalizowanym kluczu w jednym round-tripie (PostgREST `in`
--    nie potrafi sfilrować po wyrażeniu z funkcji, RPC to omija).
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.announcements_for_lecturer_keys(
  p_keys TEXT[],
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  lecturer_name TEXT,
  body TEXT,
  status TEXT,
  department TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.lecturer_name, a.body, a.status::text, a.department, a.created_at
  FROM public.announcements a
  WHERE p_keys IS NOT NULL
    AND cardinality(p_keys) > 0
    AND public.lecturer_name_key(a.lecturer_name) = ANY (p_keys)
  ORDER BY a.created_at DESC
  LIMIT GREATEST(1, LEAST(200, p_limit));
$$;

COMMENT ON FUNCTION public.announcements_for_lecturer_keys(TEXT[], INT) IS
  'Feed „Mój Plan": najnowsze komunikaty pasujące do dowolnego z kluczy wykładowców.';

GRANT EXECUTE ON FUNCTION public.announcements_for_lecturer_keys(TEXT[], INT) TO authenticated;
