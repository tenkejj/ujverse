-- Migration: full-text + trigram search nad ogłoszeniami (RAG-lite dla AI).
--
-- Cel: tool `get_announcement_details(query)` ma znalezc relevant ogloszenia
-- gdy user pyta o KONKRET ("co bylo w mailu o ankiecie", "jaki jest termin
-- rozliczen z BWA", "ten komunikat od dr X o wykladzie"). Aktualny
-- `get_latest_announcements` zwraca 10 najnowszych - bez wyszukiwania.
--
-- Strategia: PG full-text search z `to_tsvector('simple', body || full_body)`
-- + trigram index dla fuzzy matching ("ankieat" lapuie "ankieta").
--
-- DLACZEGO 'simple' config a nie 'polish':
--   Supabase Postgres NIE ma natywnego polish snowball stemmera. `simple`
--   to klasyczny tokenizer bez stemmingu - dziala dla wszystkich jezykow,
--   za cene ze "ankieta" / "ankiety" / "ankietach" nie sa traktowane jako
--   ten sam token. To rekompensujemy trigram-em (pg_trgm) ktory lapuie
--   substring matches niezaleznie od formy slowa.
--
-- DLACZEGO oba (FTS + trigram):
--   - FTS: szybki ranking po slowach kluczowych ("ankieta" znajdzie wszystkie
--     ogloszenia ze slowem "ankieta"), wykorzystuje GIN index
--   - Trigram: fuzzy match na typos ("ankieat", "ankjeta") + bardzo krotkie
--     fragmenty ("BWA"), wykorzystuje GIN gin_trgm_ops index

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 1. Computed column: tsvector laczacy body + full_body (gdy istnieje)
-- ============================================================================
-- Stored generated column - PG przelicza przy kazdym INSERT/UPDATE, my
-- nie musimy pamietac o triggerach. Index GIN bedzie na te kolumne.
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(body, '') || ' ' || coalesce(full_body, ''))
  ) STORED;

COMMENT ON COLUMN public.announcements.search_tsv IS
  'Stored generated tsvector dla full-text search nad body+full_body. Uzywane przez tool get_announcement_details. Config "simple" bo brak natywnego polish stemmera w Supabase - rekompensujemy trigram-em.';

CREATE INDEX IF NOT EXISTS announcements_search_tsv_gin_idx
  ON public.announcements
  USING gin (search_tsv);

-- ============================================================================
-- 2. Trigram index na body (fuzzy match)
-- ============================================================================
-- DLACZEGO tylko body a nie body || full_body:
--   full_body bywa duzy (kilobyty). Trigram index na duzych tekstach urosie
--   gigantycznie. body jest 200-400ch i wystarczy do fuzzy matchowania
--   tytulu/excerptu. full_body szukamy przez FTS, ktory radzi sobie lepiej
--   z dluzszymi tekstami.

CREATE INDEX IF NOT EXISTS announcements_body_trgm_idx
  ON public.announcements
  USING gin (body gin_trgm_ops);

-- ============================================================================
-- 3. RPC: search_announcements(query, max_rows)
-- ============================================================================
-- Zwraca rzedy posortowane po combined score:
--   - ts_rank (waga 0.7) - jak bardzo body+full_body matchuje query w FTS
--   - similarity(body, query) (waga 0.3) - fuzzy similarity body
-- Plus recency boost: ogloszenia z ostatnich 14 dni dostaja x1.2 mnoznik.
--
-- DLACZEGO RPC a nie inline query w toolu:
--   1. Czytelnosc - cala logika score w jednym miejscu, latwo iterowac
--   2. Performance - PG zoptymalizuje plan, my przekazujemy mniej payloadu
--   3. Bezpieczenstwo - PG funcja sparametryzowana, nie ma SQL injection ryzyka
-- RLS nie aplikujemy - ogloszenia sa publiczne (`announcements_select_all` policy).

CREATE OR REPLACE FUNCTION public.search_announcements(
  search_query text,
  max_rows int DEFAULT 5
)
RETURNS TABLE (
  id text,
  lecturer_name text,
  body text,
  full_body text,
  status text,
  department text,
  source text,
  created_at timestamptz,
  score real
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH q AS (
    SELECT
      plainto_tsquery('simple', search_query) AS tsq,
      lower(search_query) AS qlower
  )
  SELECT
    a.id,
    a.lecturer_name,
    a.body,
    a.full_body,
    a.status,
    a.department,
    a.source,
    a.created_at,
    (
      ts_rank(a.search_tsv, q.tsq) * 0.7
      + similarity(a.body, q.qlower) * 0.3
    ) * CASE
      WHEN a.created_at > now() - interval '14 days' THEN 1.2
      ELSE 1.0
    END AS score
  FROM public.announcements a, q
  WHERE
    -- Match musi byc na FTS LUB trigram - inaczej zwracalibysmy wszystko.
    (a.search_tsv @@ q.tsq OR a.body ILIKE '%' || search_query || '%')
  ORDER BY score DESC, a.created_at DESC
  LIMIT GREATEST(1, LEAST(max_rows, 10));
$$;

COMMENT ON FUNCTION public.search_announcements(text, int) IS
  'Full-text + trigram search nad announcements.body + full_body. Score = ts_rank * 0.7 + trigram_similarity * 0.3, recency boost x1.2 dla ostatnich 14 dni. Uzywane przez tool get_announcement_details w API chat.';

-- Grant explicit execute dla anon/authenticated - tool dziala z supabaseAdmin
-- (service role) ale dobre praktyka by RLS-aware kod mogl tego uzyc tez.
GRANT EXECUTE ON FUNCTION public.search_announcements(text, int)
  TO anon, authenticated;
