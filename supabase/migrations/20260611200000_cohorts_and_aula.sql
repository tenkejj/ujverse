-- Aula — czat na żywo per rocznik studiów (cohort).
--
-- Rocznik = (study_program, year_started, study_mode). Użytkownik trafia do
-- rocznika automatycznie po uzupełnieniu tych pól w profilu (trigger →
-- ensure_cohort_for_profile). MVP: jeden room per rocznik, wątki przez
-- parent_id, soft-delete, edycja własnych wiadomości.
--
-- UWAGA: `public.groups` / `public.group_memberships` to OSOBNY, niezależny
-- byt (smart-tag grupy #ankiety/#praca). Cohorts ich nie dotyka.
--
-- Migracja idempotentna (CREATE ... IF NOT EXISTS, DROP POLICY IF EXISTS,
-- guard na ALTER PUBLICATION), wzorzec z 20260601202000_create_group_memberships.sql.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Rozszerzenie profilu o pola studiów
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS study_program TEXT,
  ADD COLUMN IF NOT EXISTS year_started INTEGER,
  ADD COLUMN IF NOT EXISTS study_mode TEXT;

-- CHECK-i dodajemy warunkowo (ALTER ... ADD CONSTRAINT nie ma IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_year_started_range'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_year_started_range
      CHECK (year_started IS NULL OR (year_started >= 1990 AND year_started <= 2100));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_study_mode_allowed'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_study_mode_allowed
      CHECK (study_mode IS NULL OR study_mode IN ('stacjonarne', 'niestacjonarne', 'doktoranckie'));
  END IF;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Roczniki (cohorts)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT,
  study_program TEXT NOT NULL,
  year_started INTEGER NOT NULL,
  study_mode TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Klucz biznesowy rocznika — używany przez ON CONFLICT w RPC.
CREATE UNIQUE INDEX IF NOT EXISTS cohorts_program_year_mode_uidx
  ON public.cohorts (study_program, year_started, study_mode);

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;

-- SELECT dla wszystkich zalogowanych — pierwszaki mogą podejrzeć rocznik
-- zanim same uzupełnią profil. INSERT/UPDATE/DELETE tylko przez RPC
-- (SECURITY DEFINER omija RLS jako owner) — brak polityk = deny dla klienta.
DROP POLICY IF EXISTS cohorts_select_authenticated ON public.cohorts;
CREATE POLICY cohorts_select_authenticated
  ON public.cohorts FOR SELECT
  TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Członkostwo w roczniku (user ↔ cohort)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cohort_members (
  cohort_id UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  -- 'member' | 'admin' (starosta) — admin nieużywany w MVP, pole na przyszłość.
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cohort_members_pkey PRIMARY KEY (cohort_id, user_id)
);

CREATE INDEX IF NOT EXISTS cohort_members_user_id_idx
  ON public.cohort_members (user_id);

ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;

-- SELECT dla wszystkich zalogowanych (lista członków rocznika). Wstawki tylko
-- przez RPC SECURITY DEFINER — brak INSERT policy = deny z klienta.
DROP POLICY IF EXISTS cohort_members_select_authenticated ON public.cohort_members;
CREATE POLICY cohort_members_select_authenticated
  ON public.cohort_members FOR SELECT
  TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Wiadomości w roczniku (cohort_messages)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cohort_messages (
  id BIGSERIAL PRIMARY KEY,
  cohort_id UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id BIGINT REFERENCES public.cohort_messages (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT cohort_messages_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX IF NOT EXISTS cohort_messages_cohort_created_idx
  ON public.cohort_messages (cohort_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cohort_messages_parent_id_idx
  ON public.cohort_messages (parent_id);

-- Pełny stary wiersz w payloadzie Realtime (UPDATE soft-delete / edit).
ALTER TABLE public.cohort_messages REPLICA IDENTITY FULL;

ALTER TABLE public.cohort_messages ENABLE ROW LEVEL SECURITY;

-- SELECT/INSERT tylko dla członków rocznika.
DROP POLICY IF EXISTS cohort_messages_select_members ON public.cohort_messages;
CREATE POLICY cohort_messages_select_members
  ON public.cohort_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_messages.cohort_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS cohort_messages_insert_members ON public.cohort_messages;
CREATE POLICY cohort_messages_insert_members
  ON public.cohort_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_messages.cohort_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

-- UPDATE/DELETE tylko własnych wiadomości (edycja + soft-delete robione UPDATE'em).
DROP POLICY IF EXISTS cohort_messages_update_own ON public.cohort_messages;
CREATE POLICY cohort_messages_update_own
  ON public.cohort_messages FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS cohort_messages_delete_own ON public.cohort_messages;
CREATE POLICY cohort_messages_delete_own
  ON public.cohort_messages FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- 5. RPC: auto-utworzenie/wpięcie do rocznika na podstawie profilu
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_cohort_for_profile(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department    TEXT;
  v_program       TEXT;
  v_year          INTEGER;
  v_mode          TEXT;
  v_slug          TEXT;
  v_name          TEXT;
  v_cohort_id     UUID;
BEGIN
  SELECT department, study_program, year_started, study_mode
  INTO v_department, v_program, v_year, v_mode
  FROM public.profiles
  WHERE id = p_user_id;

  -- Profil niekompletny → no-op (nie rzucamy błędu).
  IF v_program IS NULL OR btrim(v_program) = '' OR v_year IS NULL OR v_mode IS NULL THEN
    RETURN NULL;
  END IF;

  -- Slug deterministyczny: program-rok-tryb, znormalizowany do [a-z0-9-].
  v_slug := lower(btrim(v_program)) || '-' || v_year::text || '-' || lower(btrim(v_mode));
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := btrim(v_slug, '-');

  v_name := btrim(v_program) || ', rocznik ' || v_year::text || ' (' || v_mode || ')';

  INSERT INTO public.cohorts (department, study_program, year_started, study_mode, name, slug)
  VALUES (v_department, btrim(v_program), v_year, v_mode, v_name, v_slug)
  ON CONFLICT (study_program, year_started, study_mode) DO NOTHING;

  SELECT id INTO v_cohort_id
  FROM public.cohorts
  WHERE study_program = btrim(v_program)
    AND year_started = v_year
    AND study_mode = v_mode;

  IF v_cohort_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.cohort_members (cohort_id, user_id)
  VALUES (v_cohort_id, p_user_id)
  ON CONFLICT ON CONSTRAINT cohort_members_pkey DO NOTHING;

  RETURN v_cohort_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_cohort_for_profile(UUID) IS
  'Tworzy/znajduje cohort wg (study_program, year_started, study_mode) profilu i wpina usera. No-op dla niekompletnego profilu.';

-- Trigger: po zmianie pól studiów w profilu auto-przypnij do rocznika.
CREATE OR REPLACE FUNCTION public.handle_profile_cohort_fields_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_cohort_for_profile(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_cohort_fields_change ON public.profiles;
CREATE TRIGGER on_profile_cohort_fields_change
  AFTER INSERT OR UPDATE OF study_program, year_started, study_mode, department ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_cohort_fields_change();

COMMENT ON TRIGGER on_profile_cohort_fields_change ON public.profiles IS
  'Po INSERT/UPDATE pól studiów: ensure_cohort_for_profile() wpina usera do rocznika.';

-- ──────────────────────────────────────────────────────────────────────────
-- 6. Realtime publication (idempotentnie)
-- ──────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cohort_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cohort_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cohort_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cohort_members;
  END IF;
END;
$$;
