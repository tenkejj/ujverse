-- @mentions w Auli: nowy typ powiadomień + trigger parsujący wzmianki z content.
--
-- Wzorzec dynamicznego CHECK swap: jak w 20260611200500_notifications_reply_aula_type.sql
-- (nazwa CHECK bywa autogenerowana, więc szukamy po definicji).
--
-- Trigger AFTER INSERT na cohort_messages (osobny od on_cohort_message_reply,
-- żeby działały niezależnie i pozwalały na pojedynczy reply z mention bez podwajania).
-- Logika dedup:
--   1) skip własnej wzmianki (autor == odbiorca)
--   2) skip jeśli już istnieje notyfikacja reply_aula dla tej pary (user, cohort_message_id)
--      — `@parent_author` nie powiela się z reply_aula
--   3) skip mention'ów osób spoza cohortu (brak wpisu w cohort_members)

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Rozszerzenie CHECK na notifications.type
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
    CHECK (type IN ('like', 'comment', 'reply_aula', 'mention_aula'));
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Trigger: mention_aula notyfikacje po INSERT cohort_messages
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_cohort_message_mention_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usernames TEXT[];
BEGIN
  -- Wyciągnij unikalne usernamey z `@username` w treści; regex zgodny z
  -- USERNAME_PATTERN w src/components/auth/Login.tsx (`[a-z0-9._-]+`).
  -- regexp_matches() z flagą 'g' zwraca po jednym matchu w wierszu;
  -- agregujemy do tablicy + DISTINCT (lowercased).
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
    -- skip własnej wzmianki
    AND p.id <> NEW.user_id
    -- mention tylko dla członków cohortu (bridge dla pierwszaków = no-op)
    AND EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = NEW.cohort_id AND cm.user_id = p.id
    )
    -- dedup: nie wstawiaj jeśli reply_aula już istnieje dla tej pary
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = p.id
        AND n.cohort_message_id = NEW.id
        AND n.type = 'reply_aula'
    );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_cohort_message_mention_notifications() IS
  'AFTER INSERT na cohort_messages: parsuje @username z content i wstawia mention_aula notyfikacje (z dedup z reply_aula).';

DROP TRIGGER IF EXISTS on_cohort_message_mention ON public.cohort_messages;
CREATE TRIGGER on_cohort_message_mention
  AFTER INSERT ON public.cohort_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_cohort_message_mention_notifications();
