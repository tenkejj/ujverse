-- Aula shared notes per sala: cohort_channel_notes — wspólny Markdown scratchpad.
--
-- Architektura: 1 notatka per sala (Sala główna = `channel_id IS NULL`).
-- Concurrency: last-write-wins z `version BIGINT` (RPC `update_channel_note`
-- sprawdza expected_version vs current — odrzuca konflikt z RAISE 'conflict:
-- current_version=<n>'). Klient na conflict pobiera fresh content + pokazuje
-- warning "X zaktualizował — przejrzyj zmiany".
--
-- Edit access: każdy cohort_member może edytować (Notion-style shared ownership).
-- Audit przez `last_edited_by` + `version` + `last_edited_at`.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Tabela
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cohort_channel_notes (
  id BIGSERIAL PRIMARY KEY,
  cohort_id UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  channel_id BIGINT REFERENCES public.cohort_channels (id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  version BIGINT NOT NULL DEFAULT 1,
  last_edited_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  last_edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cohort_channel_notes_content_len
    CHECK (length(content) <= 100000) -- 100KB cap, defensywnie przed flood
);

-- Dwa partial unique indexes — tak samo jak `cohort_channel_mutes`, bo PK
-- z NULL nie działa (`channel_id IS NULL` = Sala główna, ma być jeden global).
CREATE UNIQUE INDEX IF NOT EXISTS cohort_channel_notes_unique_channel
  ON public.cohort_channel_notes (cohort_id, channel_id)
  WHERE channel_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cohort_channel_notes_unique_general
  ON public.cohort_channel_notes (cohort_id)
  WHERE channel_id IS NULL;

ALTER TABLE public.cohort_channel_notes REPLICA IDENTITY FULL;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. RLS — read for cohort_member, ALL write via RPC (bezpośrednie INSERT/UPDATE
--    blokujemy, żeby version handling był jedynie przez `update_channel_note`).
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cohort_channel_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cohort_channel_notes_select_members ON public.cohort_channel_notes;
CREATE POLICY cohort_channel_notes_select_members
  ON public.cohort_channel_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_channel_notes.cohort_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

-- Bez INSERT / UPDATE / DELETE policy — wszystko idzie przez SECURITY DEFINER
-- RPC, który sam sprawdza member + version. To upraszcza concurrency.

-- ──────────────────────────────────────────────────────────────────────────
-- 3. RPC: update_channel_note
--    Args: cohort_id, channel_id (nullable), expected_version, new_content
--    Behavior:
--      - jeśli notatka nie istnieje → INSERT z version=1 (expected musi być 0)
--      - jeśli istnieje + version match → UPDATE (version++, last_edited_*)
--      - jeśli version mismatch → RAISE 'conflict:<current_version>'
--    Returns: { version BIGINT, content TEXT, last_edited_by UUID,
--              last_edited_at TIMESTAMPTZ } — JSONB obj, klient ma świeży snapshot.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_channel_note(
  p_cohort_id UUID,
  p_channel_id BIGINT,
  p_expected_version BIGINT,
  p_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_current_version BIGINT;
  v_id BIGINT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'update_channel_note: not authenticated';
  END IF;

  -- Cohort member check (RLS SELECT już to gwarantuje przy reads, tu robimy
  -- explicit dla writes które omijają RLS przez SECURITY DEFINER).
  IF NOT EXISTS (
    SELECT 1 FROM public.cohort_members cm
    WHERE cm.cohort_id = p_cohort_id AND cm.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'update_channel_note: not a cohort member';
  END IF;

  -- Channel sanity: jeśli p_channel_id != NULL, musi należeć do cohortu.
  IF p_channel_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.cohort_channels c
      WHERE c.id = p_channel_id AND c.cohort_id = p_cohort_id
    ) THEN
      RAISE EXCEPTION 'update_channel_note: channel % not in cohort %', p_channel_id, p_cohort_id;
    END IF;
  END IF;

  IF length(p_content) > 100000 THEN
    RAISE EXCEPTION 'update_channel_note: content too long (max 100000 chars)';
  END IF;

  -- IS NOT DISTINCT FROM dopasowuje NULL=NULL (Sala główna) tak samo jak
  -- konkretne channel_id.
  SELECT id, version INTO v_id, v_current_version
    FROM public.cohort_channel_notes
   WHERE cohort_id = p_cohort_id
     AND channel_id IS NOT DISTINCT FROM p_channel_id;

  IF v_id IS NULL THEN
    -- Nie istnieje — expected musi być 0 (klient wie że jest puste)
    IF p_expected_version <> 0 THEN
      RAISE EXCEPTION 'conflict:0';
    END IF;
    INSERT INTO public.cohort_channel_notes
      (cohort_id, channel_id, content, version, last_edited_by, last_edited_at)
    VALUES
      (p_cohort_id, p_channel_id, p_content, 1, v_uid, v_now);
    v_current_version := 1;
  ELSE
    IF p_expected_version <> v_current_version THEN
      RAISE EXCEPTION 'conflict:%', v_current_version;
    END IF;
    UPDATE public.cohort_channel_notes
       SET content = p_content,
           version = v_current_version + 1,
           last_edited_by = v_uid,
           last_edited_at = v_now
     WHERE id = v_id;
    v_current_version := v_current_version + 1;
  END IF;

  RETURN jsonb_build_object(
    'version', v_current_version,
    'content', p_content,
    'last_edited_by', v_uid,
    'last_edited_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_channel_note(UUID, BIGINT, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_channel_note(UUID, BIGINT, BIGINT, TEXT) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Realtime publication
-- ──────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cohort_channel_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cohort_channel_notes;
  END IF;
END;
$$;
