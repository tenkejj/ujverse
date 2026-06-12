-- Aula tasks polish: powiadomienia o nowych zadaniach (deadliney)
-- Trigger fan-out po INSERT cohort_channel_tasks → notyfikacja dla każdego
-- cohort_member NIE-mutowanego dla tej sali, oprócz twórcy.
--
-- Respect mute: skip member z `cohort_channel_mutes.mode = 'none'` i active
-- (`muted_until IS NULL OR > now()`). 'mentions_only' dla zadań traktujemy
-- jak 'all' (zadanie to nie wiadomość — mention semantyka nie ma zastosowania;
-- user który chce mention-only message'y zwykle chce widzieć też task'i).

-- ──────────────────────────────────────────────────────────────────────────
-- 1. notifications.task_id (FK do cohort_channel_tasks)
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS task_id BIGINT REFERENCES public.cohort_channel_tasks (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_task_id_idx
  ON public.notifications (task_id)
  WHERE task_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Rozszerzenie CHECK na notifications.type
--    Dynamiczny swap (nazwa CHECK autogenerowana / nadawana w migracjach).
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
    CHECK (type IN (
      'like',
      'comment',
      'reply_aula',
      'mention_aula',
      'lecturer_announcement',
      'weekly_briefing',
      'aula_task_new'
    ));
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Trigger: aula_task_new fan-out
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_task_new_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, task_id)
  SELECT
    cm.user_id,
    NEW.created_by,
    'aula_task_new',
    NEW.id
  FROM public.cohort_members cm
  WHERE cm.cohort_id = NEW.cohort_id
    -- skip twórcy
    AND cm.user_id <> NEW.created_by
    -- skip osób z active mute mode='none' dla tej sali
    AND NOT EXISTS (
      SELECT 1
      FROM public.cohort_channel_mutes m
      WHERE m.user_id = cm.user_id
        AND m.cohort_id = NEW.cohort_id
        AND m.channel_id IS NOT DISTINCT FROM NEW.channel_id
        AND m.mode = 'none'
        AND (m.muted_until IS NULL OR m.muted_until > now())
    );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_task_new_notifications() IS
  'AFTER INSERT cohort_channel_tasks: fan-out aula_task_new do cohort_members (z respect channel_mutes mode=none).';

DROP TRIGGER IF EXISTS on_cohort_task_insert_notify ON public.cohort_channel_tasks;
CREATE TRIGGER on_cohort_task_insert_notify
  AFTER INSERT ON public.cohort_channel_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_new_notifications();
