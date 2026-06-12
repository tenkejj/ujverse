-- Aula polls (ankiety) drop: cohort_message_polls + cohort_poll_votes
-- Pattern: wiadomość-host (cohort_messages) ma 1:1 poll przez UNIQUE message_id.
-- Single-select MVP (PRIMARY KEY (poll_id, user_id) — jeden głos per user na poll).
-- Cofnięcie głosu = DELETE własnego wiersza (idzie przez RPC żeby zachować atomowość).
--
-- Każdy w cohorcie:
--   - widzi poll i wszystkie głosy (transparent voting — wzmacnia social pressure
--     "Anna już zagłosowała, ja jeszcze nie")
--   - może głosować (cohort_member check w RLS + RPC)
--   - tylko TWÓRCA wiadomości-host może utworzyć poll (RLS check via cohort_messages.user_id)
--   - tylko twórca może zamknąć poll (closed_at) — RPC `close_poll`
--
-- DENY DELETE polls — usunięcie sensownie idzie tylko przez soft-delete parent
-- message (ON DELETE CASCADE z message_id). Hard-delete pollu bez usunięcia
-- wiadomości złamałby UX (treść mówi "ankieta:" a pollu nie ma).

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Tabela polls
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cohort_message_polls (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL UNIQUE REFERENCES public.cohort_messages (id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cohort_message_polls_question_len
    CHECK (length(trim(question)) BETWEEN 1 AND 240),
  CONSTRAINT cohort_message_polls_options_shape
    CHECK (
      jsonb_typeof(options) = 'array'
      AND jsonb_array_length(options) BETWEEN 2 AND 10
    )
);

CREATE INDEX IF NOT EXISTS cohort_message_polls_cohort_created_idx
  ON public.cohort_message_polls (cohort_id, created_at DESC);

ALTER TABLE public.cohort_message_polls REPLICA IDENTITY FULL;

-- BEFORE INSERT trigger: wypełnij cohort_id z parent cohort_messages
-- (klient nie musi go znać — spójność z `fill_attachment_cohort_id`).
CREATE OR REPLACE FUNCTION public.fill_poll_cohort_id()
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
    RAISE EXCEPTION 'cohort_message_polls: parent message % not found', NEW.message_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cohort_poll_insert_fill_cohort ON public.cohort_message_polls;
CREATE TRIGGER on_cohort_poll_insert_fill_cohort
  BEFORE INSERT ON public.cohort_message_polls
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_poll_cohort_id();

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Tabela votes (single-select MVP — PRIMARY KEY (poll_id, user_id))
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cohort_poll_votes (
  poll_id BIGINT NOT NULL REFERENCES public.cohort_message_polls (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL CHECK (option_index >= 0 AND option_index < 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS cohort_poll_votes_poll_idx ON public.cohort_poll_votes (poll_id);
CREATE INDEX IF NOT EXISTS cohort_poll_votes_cohort_idx ON public.cohort_poll_votes (cohort_id);

ALTER TABLE public.cohort_poll_votes REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.fill_poll_vote_cohort_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cohort_id IS NULL THEN
    SELECT cohort_id INTO NEW.cohort_id
    FROM public.cohort_message_polls
    WHERE id = NEW.poll_id;
  END IF;
  IF NEW.cohort_id IS NULL THEN
    RAISE EXCEPTION 'cohort_poll_votes: parent poll % not found', NEW.poll_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cohort_poll_vote_insert_fill_cohort ON public.cohort_poll_votes;
CREATE TRIGGER on_cohort_poll_vote_insert_fill_cohort
  BEFORE INSERT ON public.cohort_poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_poll_vote_cohort_id();

-- ──────────────────────────────────────────────────────────────────────────
-- 3. RLS
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cohort_message_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_poll_votes ENABLE ROW LEVEL SECURITY;

-- Polls: cohort_member widzi.
DROP POLICY IF EXISTS cohort_message_polls_select_members ON public.cohort_message_polls;
CREATE POLICY cohort_message_polls_select_members
  ON public.cohort_message_polls FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_message_polls.cohort_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

-- Polls INSERT: tylko autor wiadomości może doczepić poll, i musi być w cohorcie.
DROP POLICY IF EXISTS cohort_message_polls_insert_owner ON public.cohort_message_polls;
CREATE POLICY cohort_message_polls_insert_owner
  ON public.cohort_message_polls FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.cohort_messages cm
      JOIN public.cohort_members mem ON mem.cohort_id = cm.cohort_id
      WHERE cm.id = cohort_message_polls.message_id
        AND cm.user_id = (SELECT auth.uid())
        AND mem.user_id = (SELECT auth.uid())
    )
  );

-- Polls UPDATE (tylko creator, tylko closed_at) — bez kolumn-level RLS w PG, więc
-- WITH CHECK ogranicza co user może zostawić w wierszu (question/options nie da się
-- już zmienić bo nie zmieniają się NIGDY — closed_at jedyne pole edytowalne).
-- Klient zmienia wyłącznie closed_at; pozostałe kolumny musi przesłać niezmienione.
DROP POLICY IF EXISTS cohort_message_polls_update_owner ON public.cohort_message_polls;
CREATE POLICY cohort_message_polls_update_owner
  ON public.cohort_message_polls FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- DENY DELETE — soft-delete idzie przez ON DELETE CASCADE od cohort_messages
-- (gdy message hard-delete'owany jakimś admin tooling'iem, poll znika z nim).

-- Votes: cohort_member widzi wszystkie głosy.
DROP POLICY IF EXISTS cohort_poll_votes_select_members ON public.cohort_poll_votes;
CREATE POLICY cohort_poll_votes_select_members
  ON public.cohort_poll_votes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_poll_votes.cohort_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

-- Votes INSERT: cohort_member + own + poll musi należeć do tego cohortu
-- i nie być zamknięty.
DROP POLICY IF EXISTS cohort_poll_votes_insert_self ON public.cohort_poll_votes;
CREATE POLICY cohort_poll_votes_insert_self
  ON public.cohort_poll_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.cohort_message_polls p
      JOIN public.cohort_members cm ON cm.cohort_id = p.cohort_id
      WHERE p.id = cohort_poll_votes.poll_id
        AND cm.user_id = (SELECT auth.uid())
        AND p.closed_at IS NULL
    )
  );

-- Votes DELETE: tylko własny głos.
DROP POLICY IF EXISTS cohort_poll_votes_delete_self ON public.cohort_poll_votes;
CREATE POLICY cohort_poll_votes_delete_self
  ON public.cohort_poll_votes FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- 4. RPC: vote_on_poll
--    Atomowa zmiana głosu (delete-existing + insert-new) w jednej transakcji.
--    p_option_index = -1 → cofnięcie głosu (tylko delete).
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.vote_on_poll(
  p_poll_id BIGINT,
  p_option_index INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER -- wszystkie sprawdzenia idą przez RLS na votes
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_options_count INTEGER;
  v_closed_at TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'vote_on_poll: not authenticated';
  END IF;

  SELECT jsonb_array_length(options), closed_at
    INTO v_options_count, v_closed_at
    FROM public.cohort_message_polls
   WHERE id = p_poll_id;

  IF v_options_count IS NULL THEN
    RAISE EXCEPTION 'vote_on_poll: poll % not found', p_poll_id;
  END IF;

  IF v_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'vote_on_poll: poll % is closed', p_poll_id;
  END IF;

  -- Zawsze usuń stary głos (idempotentnie). DELETE RLS pozwala na own row.
  DELETE FROM public.cohort_poll_votes
    WHERE poll_id = p_poll_id AND user_id = v_uid;

  IF p_option_index >= 0 THEN
    IF p_option_index >= v_options_count THEN
      RAISE EXCEPTION 'vote_on_poll: option_index % out of range (poll has %)',
        p_option_index, v_options_count;
    END IF;

    INSERT INTO public.cohort_poll_votes (poll_id, user_id, option_index)
    VALUES (p_poll_id, v_uid, p_option_index);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.vote_on_poll(BIGINT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vote_on_poll(BIGINT, INTEGER) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 5. RPC: close_poll (tylko twórca)
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.close_poll(p_poll_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'close_poll: not authenticated';
  END IF;

  UPDATE public.cohort_message_polls
     SET closed_at = NOW()
   WHERE id = p_poll_id
     AND user_id = v_uid
     AND closed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'close_poll: poll % not found, not owned, or already closed', p_poll_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.close_poll(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_poll(BIGINT) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 6. Realtime publication (idempotentnie)
-- ──────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cohort_message_polls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cohort_message_polls;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cohort_poll_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cohort_poll_votes;
  END IF;
END;
$$;
