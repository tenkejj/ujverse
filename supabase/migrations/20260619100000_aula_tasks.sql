-- Aula tasks (zadania / deadlines) per sala: cohort_channel_tasks +
-- cohort_task_completions (per-user checkbox).
--
-- Architektura: każdy w cohorcie może dodać zadanie do dowolnej sali
-- (Sala główna = channel_id NULL). Zadanie ma:
--   - title (wymagane), description (opcjonalne)
--   - due_at (opcjonalne — deadline)
--   - priority ('low'|'normal'|'high', default 'normal')
--   - completed_at (global done — twórca może zaznaczyć "deal done", task
--     znika z listy aktywnych)
-- Each user ma własny `cohort_task_completions` wpis (PRIMARY KEY (task_id,
-- user_id)) = "Ja zrobiłem" checkbox per-user, niezależnie od global done.
--
-- Delete: tylko twórca (RLS).
-- Edit: brak w MVP (delete + create).

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Tabela tasks
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cohort_channel_tasks (
  id BIGSERIAL PRIMARY KEY,
  cohort_id UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  channel_id BIGINT REFERENCES public.cohort_channels (id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'normal',
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cohort_channel_tasks_title_len CHECK (length(trim(title)) BETWEEN 1 AND 200),
  CONSTRAINT cohort_channel_tasks_desc_len CHECK (description IS NULL OR length(description) <= 2000),
  CONSTRAINT cohort_channel_tasks_priority_check CHECK (priority IN ('low', 'normal', 'high'))
);

CREATE INDEX IF NOT EXISTS cohort_channel_tasks_cohort_channel_idx
  ON public.cohort_channel_tasks (cohort_id, channel_id, completed_at, due_at);
CREATE INDEX IF NOT EXISTS cohort_channel_tasks_creator_idx
  ON public.cohort_channel_tasks (created_by);

ALTER TABLE public.cohort_channel_tasks REPLICA IDENTITY FULL;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Tabela completions (per-user "ja zrobiłem")
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cohort_task_completions (
  task_id BIGINT NOT NULL REFERENCES public.cohort_channel_tasks (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS cohort_task_completions_user_idx
  ON public.cohort_task_completions (user_id, cohort_id);

ALTER TABLE public.cohort_task_completions REPLICA IDENTITY FULL;

-- Trigger fill cohort_id z parent task (klient nie musi go znać).
CREATE OR REPLACE FUNCTION public.fill_task_completion_cohort_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cohort_id IS NULL THEN
    SELECT cohort_id INTO NEW.cohort_id
    FROM public.cohort_channel_tasks
    WHERE id = NEW.task_id;
  END IF;
  IF NEW.cohort_id IS NULL THEN
    RAISE EXCEPTION 'cohort_task_completions: parent task % not found', NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cohort_task_completion_insert_fill_cohort ON public.cohort_task_completions;
CREATE TRIGGER on_cohort_task_completion_insert_fill_cohort
  BEFORE INSERT ON public.cohort_task_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_task_completion_cohort_id();

-- ──────────────────────────────────────────────────────────────────────────
-- 3. RLS
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cohort_channel_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_task_completions ENABLE ROW LEVEL SECURITY;

-- Tasks: cohort_member widzi.
DROP POLICY IF EXISTS cohort_channel_tasks_select_members ON public.cohort_channel_tasks;
CREATE POLICY cohort_channel_tasks_select_members
  ON public.cohort_channel_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_channel_tasks.cohort_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

-- Tasks INSERT: każdy cohort_member może utworzyć; created_by = auth.uid().
-- Channel sanity: jeśli channel_id != NULL, musi należeć do tego samego cohortu.
DROP POLICY IF EXISTS cohort_channel_tasks_insert_members ON public.cohort_channel_tasks;
CREATE POLICY cohort_channel_tasks_insert_members
  ON public.cohort_channel_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_channel_tasks.cohort_id
        AND cm.user_id = (SELECT auth.uid())
    )
    AND (
      channel_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.cohort_channels c
        WHERE c.id = cohort_channel_tasks.channel_id
          AND c.cohort_id = cohort_channel_tasks.cohort_id
      )
    )
  );

-- Tasks UPDATE: każdy cohort_member może toggle'ować `completed_at`/`completed_by`
-- (shared ownership "deal done"). Pozostałe pola (title/description/due_at/
-- priority/created_by) nie są edytowalne — RLS nie ma kolumn-level, więc
-- klient po prostu nie wysyła zmian; RPC `toggle_global_task_done` jest
-- jedynym sankcjonowanym writem na completed_at.
DROP POLICY IF EXISTS cohort_channel_tasks_update_members ON public.cohort_channel_tasks;
CREATE POLICY cohort_channel_tasks_update_members
  ON public.cohort_channel_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_channel_tasks.cohort_id
        AND cm.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_channel_tasks.cohort_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

-- Tasks DELETE: tylko twórca.
DROP POLICY IF EXISTS cohort_channel_tasks_delete_creator ON public.cohort_channel_tasks;
CREATE POLICY cohort_channel_tasks_delete_creator
  ON public.cohort_channel_tasks FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Completions: cohort_member widzi wszystkie completions w cohorcie
-- (transparent "8/24 zrobiło — w tym Anna, Janek").
DROP POLICY IF EXISTS cohort_task_completions_select_members ON public.cohort_task_completions;
CREATE POLICY cohort_task_completions_select_members
  ON public.cohort_task_completions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_task_completions.cohort_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

-- Completions INSERT/DELETE: tylko własne (toggle "ja zrobiłem").
DROP POLICY IF EXISTS cohort_task_completions_insert_self ON public.cohort_task_completions;
CREATE POLICY cohort_task_completions_insert_self
  ON public.cohort_task_completions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.cohort_channel_tasks t
      JOIN public.cohort_members cm ON cm.cohort_id = t.cohort_id
      WHERE t.id = cohort_task_completions.task_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS cohort_task_completions_delete_self ON public.cohort_task_completions;
CREATE POLICY cohort_task_completions_delete_self
  ON public.cohort_task_completions FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- 4. RPC: toggle_my_task_completion
--    Atomowy toggle wpisu w `cohort_task_completions`. Bez argumentu state —
--    sam wyznacza next state (delete jeśli istnieje, insert inaczej).
--    Returns: BOOLEAN (true = completed po wywołaniu, false = unchecked).
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.toggle_my_task_completion(p_task_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existed BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'toggle_my_task_completion: not authenticated';
  END IF;

  DELETE FROM public.cohort_task_completions
   WHERE task_id = p_task_id AND user_id = v_uid
  RETURNING true INTO v_existed;

  IF COALESCE(v_existed, false) THEN
    RETURN false; -- przed wywołaniem był completed, teraz unchecked
  END IF;

  INSERT INTO public.cohort_task_completions (task_id, user_id)
  VALUES (p_task_id, v_uid);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_my_task_completion(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_my_task_completion(BIGINT) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 5. RPC: toggle_global_task_done
--    Atomowy toggle `completed_at` na zadaniu (shared "deal done").
--    Każdy w cohorcie może toggle'ować (Notion-style shared task closing).
--    Returns: TIMESTAMPTZ — nowy `completed_at` (NULL gdy odznaczono).
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.toggle_global_task_done(p_task_id BIGINT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_current TIMESTAMPTZ;
  v_new TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'toggle_global_task_done: not authenticated';
  END IF;

  SELECT completed_at INTO v_current
    FROM public.cohort_channel_tasks
   WHERE id = p_task_id;

  IF v_current IS NULL THEN
    v_new := NOW();
    UPDATE public.cohort_channel_tasks
       SET completed_at = v_new, completed_by = v_uid
     WHERE id = p_task_id;
  ELSE
    v_new := NULL;
    UPDATE public.cohort_channel_tasks
       SET completed_at = NULL, completed_by = NULL
     WHERE id = p_task_id;
  END IF;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_global_task_done(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_global_task_done(BIGINT) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 6. Realtime publication
-- ──────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cohort_channel_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cohort_channel_tasks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cohort_task_completions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cohort_task_completions;
  END IF;
END;
$$;
