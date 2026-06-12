-- „Mój Plan" Faza 1B: timetable importowany z USOSweb (.ics).
--
-- Buduje na public.lecturer_name_key (z 20260615100000_lecturer_subscriptions.sql)
-- — `lecturer_key` jest GENERATED ze `lecturer_name`, więc match z subskrypcjami
-- i z `announcements` jest po dokładnie tym samym kluczu (zero rozjazdu).
--
-- Wzorzec idempotentnego importu: UNIQUE(user_id, uid) — ICS daje stabilny UID
-- per wystąpienie zajęć, więc re-import nie tworzy duplikatów. Brakuje UID
-- (rzadko, ale się zdarza w nietypowych eksportach) — wpadamy w fallback
-- syntetycznego UID `<user_id>:<start>:<summary_hash>` po stronie klienta.

CREATE TABLE IF NOT EXISTS public.user_timetable_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  uid TEXT NOT NULL,
  summary TEXT NOT NULL,
  -- Wykładowca z ORGANIZER.CN / parsingu DESCRIPTION. Może być NULL — wtedy
  -- entry jest pokazywane bez badge'a odwołania (brak po czym matchować).
  lecturer_name TEXT,
  lecturer_key TEXT GENERATED ALWAYS AS (public.lecturer_name_key(lecturer_name)) STORED,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'usos_ics',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_timetable_entries_user_uid_uniq UNIQUE (user_id, uid),
  CONSTRAINT user_timetable_entries_time_check CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS user_timetable_user_start_idx
  ON public.user_timetable_entries (user_id, start_time);

CREATE INDEX IF NOT EXISTS user_timetable_user_key_idx
  ON public.user_timetable_entries (user_id, lecturer_key)
  WHERE lecturer_key IS NOT NULL;

ALTER TABLE public.user_timetable_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_timetable_select_own ON public.user_timetable_entries;
DROP POLICY IF EXISTS user_timetable_insert_own ON public.user_timetable_entries;
DROP POLICY IF EXISTS user_timetable_update_own ON public.user_timetable_entries;
DROP POLICY IF EXISTS user_timetable_delete_own ON public.user_timetable_entries;

CREATE POLICY user_timetable_select_own
  ON public.user_timetable_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY user_timetable_insert_own
  ON public.user_timetable_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_timetable_update_own
  ON public.user_timetable_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_timetable_delete_own
  ON public.user_timetable_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────────
-- RPC: get_timetable_for_range — zajęcia w przedziale + flaga odwołania
--
-- Zwraca każdy entry razem z najnowszym pasującym komunikatem ze statusem
-- 'cancelled' z ostatnich `p_announcement_window_hours` (default 168 = 7 dni).
-- Match po `lecturer_key` (zero rozjazdu, bo obie strony używają tej samej
-- IMMUTABLE funkcji `lecturer_name_key`).
--
-- LATERAL JOIN żeby pobrać najnowszy 1 komunikat per entry bez window funkcji.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_timetable_for_range(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_announcement_window_hours INT DEFAULT 168
)
RETURNS TABLE (
  id BIGINT,
  uid TEXT,
  summary TEXT,
  lecturer_name TEXT,
  lecturer_key TEXT,
  location TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  cancelled_announcement_id UUID,
  cancelled_announcement_body TEXT,
  cancelled_announcement_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.uid,
    e.summary,
    e.lecturer_name,
    e.lecturer_key,
    e.location,
    e.start_time,
    e.end_time,
    a.id AS cancelled_announcement_id,
    a.body AS cancelled_announcement_body,
    a.created_at AS cancelled_announcement_at
  FROM public.user_timetable_entries e
  LEFT JOIN LATERAL (
    SELECT a2.id, a2.body, a2.created_at
    FROM public.announcements a2
    WHERE e.lecturer_key IS NOT NULL
      AND a2.status = 'cancelled'
      AND public.lecturer_name_key(a2.lecturer_name) = e.lecturer_key
      AND a2.created_at >= (now() - make_interval(hours => GREATEST(1, LEAST(720, p_announcement_window_hours))))
    ORDER BY a2.created_at DESC
    LIMIT 1
  ) a ON true
  WHERE e.user_id = auth.uid()
    AND e.start_time >= p_from
    AND e.start_time < p_to
  ORDER BY e.start_time ASC;
$$;

COMMENT ON FUNCTION public.get_timetable_for_range(TIMESTAMPTZ, TIMESTAMPTZ, INT) IS
  'Plan zajęć w przedziale [from, to) dla auth.uid() + LATERAL match komunikatu o odwołaniu (status=cancelled, lecturer_key, okno N godzin).';

GRANT EXECUTE ON FUNCTION public.get_timetable_for_range(TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;
