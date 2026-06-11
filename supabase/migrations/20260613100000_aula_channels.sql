-- Aula sub-channels drop:
--   1) Nowa tabela `cohort_channels` (sub-kanały per cohort, Discord-style).
--   2) `cohort_messages` += `channel_id BIGINT NULL` (NULL = virtual #general).
--   3) Trigger walidujący że message.channel.cohort_id == message.cohort_id.
--   4) RLS: open SELECT/INSERT (każdy member), UPDATE creator-only,
--      brak DELETE policy → wszystkie DELETE z roli `authenticated` są
--      odrzucone (archive zamiast hard-delete; chroni historię + przed troll
--      cleanupem).
--   5) Pin RPC zmiana — cap 10 PER CHANNEL (nie per cohort jak w MVP).
--      Wymiarem jest `(cohort_id, channel_id)` — NULL channel_id (=#general)
--      traktowany jak każdy inny kanał (IS NOT DISTINCT FROM).
--   6) Realtime publication += `cohort_channels`.
--
-- Migracja idempotentna (CREATE ... IF NOT EXISTS, DROP POLICY IF EXISTS,
-- guard na ALTER PUBLICATION).

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Tabela cohort_channels
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cohort_channels (
  id BIGSERIAL PRIMARY KEY,
  cohort_id UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  -- Reserved 'general' bo to virtual #general (NULL channel_id) i nie chcemy
  -- konfliktu URL `?channel=general`.
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9_-]{0,30}$' AND slug <> 'general'),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  description TEXT CHECK (description IS NULL OR length(description) <= 280),
  -- SET NULL żeby kanał pozostał gdy creator skasuje konto — robi się
  -- "anonimowy" (nikt nie może go już edytować ani archive'ować, ale
  -- wiadomości żyją dalej).
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  CONSTRAINT cohort_channels_slug_unique UNIQUE (cohort_id, slug)
);

CREATE INDEX IF NOT EXISTS cohort_channels_cohort_idx
  ON public.cohort_channels (cohort_id, archived_at NULLS FIRST, created_at DESC);

ALTER TABLE public.cohort_channels REPLICA IDENTITY FULL;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. cohort_messages += channel_id
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cohort_messages
  ADD COLUMN IF NOT EXISTS channel_id BIGINT REFERENCES public.cohort_channels (id) ON DELETE SET NULL;

-- Główny index do listingu wiadomości w kanale. Stary `cohort_messages_cohort_created_idx`
-- zostawiamy (pin queries / cohort-wide statystyki dalej go używają).
CREATE INDEX IF NOT EXISTS cohort_messages_cohort_channel_created_idx
  ON public.cohort_messages (cohort_id, channel_id, created_at DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Trigger walidujący channel-cohort match
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_cohort_message_channel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_channel_cohort UUID;
BEGIN
  IF NEW.channel_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cohort_id INTO v_channel_cohort
  FROM public.cohort_channels
  WHERE id = NEW.channel_id;

  IF v_channel_cohort IS NULL THEN
    RAISE EXCEPTION 'cohort_messages: channel % not found', NEW.channel_id;
  END IF;

  IF v_channel_cohort <> NEW.cohort_id THEN
    RAISE EXCEPTION 'cohort_messages: channel cohort mismatch (channel=%, message=%)',
      v_channel_cohort, NEW.cohort_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cohort_message_validate_channel ON public.cohort_messages;
CREATE TRIGGER on_cohort_message_validate_channel
  BEFORE INSERT OR UPDATE OF channel_id ON public.cohort_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cohort_message_channel();

-- ──────────────────────────────────────────────────────────────────────────
-- 4. RLS — open SELECT/INSERT, creator-only UPDATE, brak DELETE
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cohort_channels ENABLE ROW LEVEL SECURITY;

-- SELECT: każdy członek cohortu (włącznie z archived).
DROP POLICY IF EXISTS cohort_channels_select_members ON public.cohort_channels;
CREATE POLICY cohort_channels_select_members
  ON public.cohort_channels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_channels.cohort_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

-- INSERT: każdy członek + `created_by` MUSI być currently auth.uid()
-- (chroni przed podszywaniem się pod cudzy creator).
DROP POLICY IF EXISTS cohort_channels_insert_members ON public.cohort_channels;
CREATE POLICY cohort_channels_insert_members
  ON public.cohort_channels FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_channels.cohort_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

-- UPDATE: tylko creator (edycja name/description/archived_at).
-- NIE pozwalamy zmienić `cohort_id` / `slug` / `created_by` — sanity
-- (zmiana cohort_id zerwałaby trigger, zmiana slug zerwałaby URL deep-linki).
DROP POLICY IF EXISTS cohort_channels_update_creator ON public.cohort_channels;
CREATE POLICY cohort_channels_update_creator
  ON public.cohort_channels FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()))
  WITH CHECK (
    created_by = (SELECT auth.uid())
    -- Wymuś że pola "tożsamości" kanału nie zmieniają się przy UPDATE.
    -- (Postgres nie wystawia OLD w policy, więc to tylko soft guard
    -- przeciwko podszywaniu się; pełna ochrona = brak `cohort_id` /
    -- `slug` w `updateChannel` po stronie service warstwy.)
  );

-- BRAK POLITYKI DELETE = wszystkie DELETE od roli `authenticated` odrzucone.
-- Archive (UPDATE archived_at) jest jedyną drogą "usunięcia" kanału.
-- (Service-role / db owner mogą dalej hard-delete — defensywny ON DELETE
-- SET NULL na cohort_messages.channel_id zachowuje wiadomości jako #general.)

-- ──────────────────────────────────────────────────────────────────────────
-- 5. Pin RPC update — cap PER CHANNEL (nie per cohort)
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.toggle_cohort_message_pin(p_message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := (SELECT auth.uid());
  v_cohort_id    UUID;
  v_channel_id   BIGINT;
  v_pinned_at    TIMESTAMPTZ;
  v_pinned_count INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT cohort_id, channel_id, pinned_at
  INTO v_cohort_id, v_channel_id, v_pinned_at
  FROM public.cohort_messages
  WHERE id = p_message_id;

  IF v_cohort_id IS NULL THEN
    RAISE EXCEPTION 'message_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.cohort_members
    WHERE cohort_id = v_cohort_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'not_cohort_member';
  END IF;

  IF v_pinned_at IS NULL THEN
    -- Cap 10 PER CHANNEL — `IS NOT DISTINCT FROM` traktuje NULL=NULL jako
    -- równe (więc #general ma własny cap 10 niezależny od pozostałych
    -- kanałów).
    SELECT count(*) INTO v_pinned_count
    FROM public.cohort_messages
    WHERE cohort_id = v_cohort_id
      AND channel_id IS NOT DISTINCT FROM v_channel_id
      AND pinned_at IS NOT NULL;

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
  'Pin/unpin wiadomości Auli (SECURITY DEFINER omija UPDATE-own RLS). Cap 10 PER CHANNEL (channel_id IS NOT DISTINCT FROM); RAISE pin_limit_reached gdy przekroczone.';

REVOKE ALL ON FUNCTION public.toggle_cohort_message_pin(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_cohort_message_pin(BIGINT) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 6. Realtime publication (idempotentnie)
-- ──────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cohort_channels'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cohort_channels;
  END IF;
END;
$$;
