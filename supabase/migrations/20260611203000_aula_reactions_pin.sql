-- Aula engagement drop:
--   1) Reactions na cohort_messages — nowa tabela cohort_message_reactions
--      (denormalizowane cohort_id przez BEFORE INSERT trigger żeby Realtime
--      mógł filtrować po cohort_id bez JOINów).
--   2) Pin: kolumny pinned_at/pinned_by na cohort_messages + RPC SECURITY
--      DEFINER żeby ominąć "UPDATE only own row" policy bez rozdrabniania
--      policy na poziom kolumn.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Tabela reakcji
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cohort_message_reactions (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES public.cohort_messages (id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cohort_message_reactions_unique UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS cohort_message_reactions_message_idx
  ON public.cohort_message_reactions (message_id);
CREATE INDEX IF NOT EXISTS cohort_message_reactions_cohort_created_idx
  ON public.cohort_message_reactions (cohort_id, created_at DESC);

-- BEFORE INSERT trigger: fill cohort_id z cohort_messages żeby klient nie musiał go znać.
CREATE OR REPLACE FUNCTION public.fill_cohort_reaction_cohort_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cohort_id IS NULL THEN
    SELECT cohort_id INTO NEW.cohort_id
    FROM public.cohort_messages
    WHERE id = NEW.message_id;
  END IF;
  IF NEW.cohort_id IS NULL THEN
    RAISE EXCEPTION 'cohort_message_reactions: parent message % not found', NEW.message_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cohort_reaction_insert_fill_cohort ON public.cohort_message_reactions;
CREATE TRIGGER on_cohort_reaction_insert_fill_cohort
  BEFORE INSERT ON public.cohort_message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_cohort_reaction_cohort_id();

ALTER TABLE public.cohort_message_reactions ENABLE ROW LEVEL SECURITY;

-- SELECT: członkowie cohortu mogą widzieć reakcje wewnątrz swojego rocznika.
DROP POLICY IF EXISTS cohort_message_reactions_select_members ON public.cohort_message_reactions;
CREATE POLICY cohort_message_reactions_select_members
  ON public.cohort_message_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_message_reactions.cohort_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

-- INSERT: członkowie + własny user_id (cohort_id wypełniany przez trigger).
DROP POLICY IF EXISTS cohort_message_reactions_insert_members ON public.cohort_message_reactions;
CREATE POLICY cohort_message_reactions_insert_members
  ON public.cohort_message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.cohort_messages cm
      JOIN public.cohort_members mem ON mem.cohort_id = cm.cohort_id
      WHERE cm.id = cohort_message_reactions.message_id
        AND mem.user_id = (SELECT auth.uid())
    )
  );

-- DELETE: tylko własne reakcje.
DROP POLICY IF EXISTS cohort_message_reactions_delete_own ON public.cohort_message_reactions;
CREATE POLICY cohort_message_reactions_delete_own
  ON public.cohort_message_reactions FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Pin: kolumny + RPC
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cohort_messages
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cohort_messages_cohort_pinned_idx
  ON public.cohort_messages (cohort_id, pinned_at DESC)
  WHERE pinned_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.toggle_cohort_message_pin(p_message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := (SELECT auth.uid());
  v_cohort_id    UUID;
  v_pinned_at    TIMESTAMPTZ;
  v_pinned_count INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT cohort_id, pinned_at
  INTO v_cohort_id, v_pinned_at
  FROM public.cohort_messages
  WHERE id = p_message_id;

  IF v_cohort_id IS NULL THEN
    RAISE EXCEPTION 'message_not_found';
  END IF;

  -- Membership guard — tylko członek cohortu może pinować.
  IF NOT EXISTS (
    SELECT 1 FROM public.cohort_members
    WHERE cohort_id = v_cohort_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'not_cohort_member';
  END IF;

  IF v_pinned_at IS NULL THEN
    -- Cap 10 przypiętych per cohort.
    SELECT count(*) INTO v_pinned_count
    FROM public.cohort_messages
    WHERE cohort_id = v_cohort_id AND pinned_at IS NOT NULL;

    IF v_pinned_count >= 10 THEN
      RAISE EXCEPTION 'pin_limit_reached';
    END IF;

    UPDATE public.cohort_messages
    SET pinned_at = NOW(), pinned_by = v_uid
    WHERE id = p_message_id;

    RETURN TRUE;
  ELSE
    UPDATE public.cohort_messages
    SET pinned_at = NULL, pinned_by = NULL
    WHERE id = p_message_id;

    RETURN FALSE;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.toggle_cohort_message_pin(BIGINT) IS
  'Pin/unpin wiadomości Auli (SECURITY DEFINER omija UPDATE-own RLS). Cap 10 per cohort; RAISE pin_limit_reached gdy przekroczone.';

REVOKE ALL ON FUNCTION public.toggle_cohort_message_pin(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_cohort_message_pin(BIGINT) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Realtime publication (idempotentnie)
-- ──────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cohort_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cohort_message_reactions;
  END IF;
END;
$$;

-- DELETE Realtime payload potrzebuje pełnego wiersza żeby klient mógł
-- z payloadu zdjąć dokładnie tę (user_id, emoji) parę.
ALTER TABLE public.cohort_message_reactions REPLICA IDENTITY FULL;
