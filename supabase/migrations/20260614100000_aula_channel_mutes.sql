-- Per-user per-channel notification mutes dla Auli.
--
-- Każdy user może wyciszyć konkretną salę (lub Salę główną — virtual #general
-- z channel_id IS NULL) w jednym z 3 trybów: 'all' (default, brak wyciszenia),
-- 'mentions_only' (tylko @username powiadamia), 'none' (nic). Opcjonalny
-- `muted_until` pozwala na snooze (po wygaśnięciu trigger traktuje jak 'all').
--
-- Triggery `handle_cohort_message_reply_notification` i
-- `handle_cohort_message_mention_notifications` są zaktualizowane żeby
-- respektować mute przed INSERT do notifications.
--
-- Convention: brak rekordu = mode 'all' (default). UI usuwa rekord gdy user
-- wraca do default (zamiast trzymać "mode='all'" wpis) — utrzymuje tabelę
-- chudą.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Tabela cohort_channel_mutes
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cohort_channel_mutes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  -- NULL = Sala główna (virtual #general). Konkretny FK = sub-channel.
  channel_id BIGINT REFERENCES public.cohort_channels (id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'all',
  -- NULL = wyciszone "na zawsze" (do ręcznego cofnięcia). Konkretny timestamp
  -- = snooze do tej chwili (po wygaśnięciu trigger ignoruje rekord).
  muted_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cohort_channel_mutes_mode_check
    CHECK (mode IN ('all', 'mentions_only', 'none'))
);

-- Uniqueness: (user, cohort, channel) — channel_id NULL traktowane jako odrębny
-- "row" (Sala główna). PK na NULL kolumnie nie zadziała, więc dwa partial unique
-- indexy.
CREATE UNIQUE INDEX IF NOT EXISTS cohort_channel_mutes_user_channel_uniq
  ON public.cohort_channel_mutes (user_id, cohort_id, channel_id)
  WHERE channel_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cohort_channel_mutes_user_general_uniq
  ON public.cohort_channel_mutes (user_id, cohort_id)
  WHERE channel_id IS NULL;

-- Lookup index dla triggerów (per-user-per-channel hit).
CREATE INDEX IF NOT EXISTS cohort_channel_mutes_lookup_idx
  ON public.cohort_channel_mutes (user_id, cohort_id, channel_id);

ALTER TABLE public.cohort_channel_mutes REPLICA IDENTITY FULL;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. updated_at trigger (touch on update)
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_cohort_channel_mute_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cohort_channel_mute_touch ON public.cohort_channel_mutes;
CREATE TRIGGER on_cohort_channel_mute_touch
  BEFORE UPDATE ON public.cohort_channel_mutes
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_cohort_channel_mute_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- 3. RLS
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cohort_channel_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cohort_channel_mutes_select_own ON public.cohort_channel_mutes;
CREATE POLICY cohort_channel_mutes_select_own
  ON public.cohort_channel_mutes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS cohort_channel_mutes_insert_own ON public.cohort_channel_mutes;
CREATE POLICY cohort_channel_mutes_insert_own
  ON public.cohort_channel_mutes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    -- Sanity: user musi być członkiem cohortu (defensywnie, nie tylko UI guard)
    AND EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_channel_mutes.cohort_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cohort_channel_mutes_update_own ON public.cohort_channel_mutes;
CREATE POLICY cohort_channel_mutes_update_own
  ON public.cohort_channel_mutes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS cohort_channel_mutes_delete_own ON public.cohort_channel_mutes;
CREATE POLICY cohort_channel_mutes_delete_own
  ON public.cohort_channel_mutes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Realtime publication
-- ──────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cohort_channel_mutes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.cohort_channel_mutes';
  END IF;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 5. RPC: set_channel_mute (upsert/delete helper)
-- ──────────────────────────────────────────────────────────────────────────
--
-- p_mode = 'all' usuwa rekord (default state, brak wpisu = brak wyciszenia).
-- p_mode = 'mentions_only' / 'none' upsertuje z opcjonalnym p_snooze_hours
-- (NULL → wycisz na zawsze, number → muted_until = now() + interval).
-- Idempotentne, RLS-bezpieczne (SECURITY INVOKER — używa policy own).

CREATE OR REPLACE FUNCTION public.set_channel_mute(
  p_cohort_id UUID,
  p_channel_id BIGINT DEFAULT NULL,
  p_mode TEXT DEFAULT 'all',
  p_snooze_hours INTEGER DEFAULT NULL
)
RETURNS public.cohort_channel_mutes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_until TIMESTAMPTZ;
  v_row public.cohort_channel_mutes;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_mode NOT IN ('all', 'mentions_only', 'none') THEN
    RAISE EXCEPTION 'invalid_mute_mode: %', p_mode;
  END IF;

  -- mode='all' = reset do defaultu = usuń rekord (jeśli istnieje).
  IF p_mode = 'all' THEN
    IF p_channel_id IS NULL THEN
      DELETE FROM public.cohort_channel_mutes
      WHERE user_id = v_user
        AND cohort_id = p_cohort_id
        AND channel_id IS NULL;
    ELSE
      DELETE FROM public.cohort_channel_mutes
      WHERE user_id = v_user
        AND cohort_id = p_cohort_id
        AND channel_id = p_channel_id;
    END IF;
    RETURN NULL;
  END IF;

  v_until := CASE
    WHEN p_snooze_hours IS NULL THEN NULL
    WHEN p_snooze_hours <= 0 THEN NULL
    ELSE now() + (p_snooze_hours || ' hours')::interval
  END;

  -- Upsert. Można by zrobić ON CONFLICT ale partial unique index z NULL nie
  -- zadziała (Postgres traktuje NULLs jako not equal). Robimy explicit
  -- delete+insert w transakcji.
  IF p_channel_id IS NULL THEN
    DELETE FROM public.cohort_channel_mutes
    WHERE user_id = v_user
      AND cohort_id = p_cohort_id
      AND channel_id IS NULL;
  ELSE
    DELETE FROM public.cohort_channel_mutes
    WHERE user_id = v_user
      AND cohort_id = p_cohort_id
      AND channel_id = p_channel_id;
  END IF;

  INSERT INTO public.cohort_channel_mutes (user_id, cohort_id, channel_id, mode, muted_until)
  VALUES (v_user, p_cohort_id, p_channel_id, p_mode, v_until)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.set_channel_mute(UUID, BIGINT, TEXT, INTEGER) IS
  'Upsert/delete mute prefs dla aktualnego usera. mode=all = delete (default). RLS via own-policy on table.';

GRANT EXECUTE ON FUNCTION public.set_channel_mute(UUID, BIGINT, TEXT, INTEGER) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 6. Update triggers: respect mute przed INSERT notification
-- ──────────────────────────────────────────────────────────────────────────

-- 6a. Reply trigger: jeśli parent_author ma mute z mode='none' LUB mode='mentions_only'
-- (reply nie liczy się jako mention) — skip notification. Snooze (muted_until > now())
-- też skip.
CREATE OR REPLACE FUNCTION public.handle_cohort_message_reply_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_author UUID;
  v_mute RECORD;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_parent_author
  FROM public.cohort_messages
  WHERE id = NEW.parent_id;

  IF v_parent_author IS NULL OR v_parent_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Sprawdź mute parent_author dla docelowego kanału.
  SELECT mode, muted_until INTO v_mute
  FROM public.cohort_channel_mutes
  WHERE user_id = v_parent_author
    AND cohort_id = NEW.cohort_id
    AND channel_id IS NOT DISTINCT FROM NEW.channel_id
  LIMIT 1;

  IF FOUND THEN
    -- Aktywny mute (muted_until NULL = forever, > now() = snooze pending).
    IF v_mute.muted_until IS NULL OR v_mute.muted_until > now() THEN
      -- Reply nie jest mentionem → 'mentions_only' też skip reply.
      IF v_mute.mode IN ('none', 'mentions_only') THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, cohort_message_id)
  VALUES (v_parent_author, NEW.user_id, 'reply_aula', NEW.id);

  RETURN NEW;
END;
$$;

-- 6b. Mention trigger: mode='none' + active snooze → skip. 'mentions_only' →
-- mention przechodzi. Filter w SQL przez NOT EXISTS na mute z 'none' active.
CREATE OR REPLACE FUNCTION public.handle_cohort_message_mention_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usernames TEXT[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT lower(m[1])), ARRAY[]::text[])
  INTO v_usernames
  FROM regexp_matches(NEW.content, '(?:^|\s)@([a-z0-9._-]+)', 'gi') AS m;

  IF v_usernames IS NULL OR cardinality(v_usernames) = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, cohort_message_id)
  SELECT
    p.id,
    NEW.user_id,
    'mention_aula',
    NEW.id
  FROM public.profiles p
  WHERE lower(p.username) = ANY (v_usernames)
    AND p.id <> NEW.user_id
    AND EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = NEW.cohort_id AND cm.user_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = p.id
        AND n.cohort_message_id = NEW.id
        AND n.type = 'reply_aula'
    )
    -- Pomiń jeśli user ma aktywny mute z mode='none' dla tego kanału
    -- (mentions_only nadal przepuszcza mention).
    AND NOT EXISTS (
      SELECT 1 FROM public.cohort_channel_mutes m
      WHERE m.user_id = p.id
        AND m.cohort_id = NEW.cohort_id
        AND m.channel_id IS NOT DISTINCT FROM NEW.channel_id
        AND m.mode = 'none'
        AND (m.muted_until IS NULL OR m.muted_until > now())
    );

  RETURN NEW;
END;
$$;
