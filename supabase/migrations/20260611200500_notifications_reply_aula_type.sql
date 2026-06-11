-- Powiadomienia o odpowiedziach w Auli (cohort_messages.parent_id).
--
-- Rozszerza public.notifications (z 20260514140000_notifications_table_rls.sql)
-- o nowy typ 'reply_aula' + kolumnę cohort_message_id. Trigger reply-notification
-- żyje tutaj (a nie w 20260611200000), bo wymaga już istniejącej kolumny i typu.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Rozszerzenie CHECK na notifications.type
-- ──────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Znajdź istniejący CHECK na kolumnie type (nazwa bywa autogenerowana).
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
    CHECK (type IN ('like', 'comment', 'reply_aula'));
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Kolumna referencji do wiadomości w Auli
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS cohort_message_id BIGINT
  REFERENCES public.cohort_messages (id) ON DELETE CASCADE;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Trigger: reply w Auli → powiadomienie dla autora rodzica
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_cohort_message_reply_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_author UUID;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_parent_author
  FROM public.cohort_messages
  WHERE id = NEW.parent_id;

  -- Brak rodzica albo odpowiedź na własną wiadomość → bez powiadomienia.
  IF v_parent_author IS NULL OR v_parent_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, cohort_message_id)
  VALUES (v_parent_author, NEW.user_id, 'reply_aula', NEW.id);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_cohort_message_reply_notification() IS
  'AFTER INSERT na cohort_messages: dla odpowiedzi (parent_id) wstawia notification reply_aula do autora rodzica.';

DROP TRIGGER IF EXISTS on_cohort_message_reply ON public.cohort_messages;
CREATE TRIGGER on_cohort_message_reply
  AFTER INSERT ON public.cohort_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_cohort_message_reply_notification();
