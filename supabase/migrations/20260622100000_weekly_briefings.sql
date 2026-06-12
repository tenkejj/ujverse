-- „Tygodniowy briefing" — spersonalizowany przegląd tygodnia studenta.
--
-- Filozofia:
--   * Briefing = wiersz w `weekly_briefings` z JSONB payloadem + 1:1 notyfikacja
--     typu `weekly_briefing` (zero rozjazdu między „dostałeś push" a „masz dane").
--   * Idempotencja przez UNIQUE(user_id, week_start). Re-generacja w tym samym
--     tygodniu nadpisuje payload + bumpuje generated_at, ale tej samej
--     notyfikacji nie duplikuje (ON CONFLICT na briefing_id w notifications).
--   * Lazy generation: klient woła RPC `ensure_weekly_briefing` przy wejściu
--     do `/briefing` lub gdy widget na feedzie się montuje. Brak briefingu na
--     ten tydzień → policz teraz. Brak cronu na backendzie ≠ brak feature'u.
--   * Cron (Vercel cronjob → REST RPC) generuje briefingi proaktywnie w pn 07:00
--     UTC (= 09:00 CEST / 08:00 CET — kompromis DST), żeby push przychodził
--     ZANIM user otworzy apkę. Bez cronu apka i tak działa, briefing czeka na
--     pierwsze otwarcie.
--
-- Payload schema (typed w `src/types/briefing.ts`):
--   {
--     week_start: 'YYYY-MM-DD',
--     week_end:   'YYYY-MM-DD',
--     classes:    { total, hours, days_with_classes, cancelled, first, last },
--     changes:    [ { kind, title, starts_at, location, source_id } ],   -- z calendar_entries
--     announcements_from_subscribed: [ { id, lecturer_name, body, status, created_at } ],
--     official_events: [ { id, title, starts_at, ends_at, location } ],
--     next_exam:  { title, starts_at, days_away } | null
--   }
--
-- Reuse: `lecturer_name_key`, `user_timetable_entries`, `lecturer_subscriptions`,
-- `calendar_entries`, `announcements`.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Tabela weekly_briefings
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.weekly_briefings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  -- Poniedziałek 00:00 Europe/Warsaw jako DATE (data lokalna, nie UTC).
  week_start DATE NOT NULL,
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT weekly_briefings_user_week_uniq UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS weekly_briefings_user_week_desc_idx
  ON public.weekly_briefings (user_id, week_start DESC);

ALTER TABLE public.weekly_briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_briefings_select_own ON public.weekly_briefings;
CREATE POLICY weekly_briefings_select_own
  ON public.weekly_briefings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Brak polityk INSERT/UPDATE/DELETE — pisanie wyłącznie przez SECURITY DEFINER
-- RPC (ensure_weekly_briefing / generate_weekly_briefings_for_week).

-- ──────────────────────────────────────────────────────────────────────────
-- 2. notifications: dorzucamy 'weekly_briefing' do CHECK + briefing_id FK
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
      'like', 'comment', 'reply_aula', 'mention_aula',
      'lecturer_announcement', 'weekly_briefing'
    ));
END;
$$;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS briefing_id BIGINT
  REFERENCES public.weekly_briefings (id) ON DELETE CASCADE;

-- Bez tego indeksu ON CONFLICT (briefing_id) WHERE … by nie miał targetu.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_briefing_uniq
  ON public.notifications (user_id, briefing_id)
  WHERE briefing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_briefing_idx
  ON public.notifications (briefing_id) WHERE briefing_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Helper: poniedziałek tygodnia dla daty (Europe/Warsaw)
--    Zwraca DATE — interpretowane w strefie lokalnej.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.warsaw_week_start(p_at TIMESTAMPTZ DEFAULT NOW())
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (date_trunc('week', p_at AT TIME ZONE 'Europe/Warsaw'))::DATE;
$$;

COMMENT ON FUNCTION public.warsaw_week_start(TIMESTAMPTZ) IS
  'Poniedziałek tygodnia kalendarzowego w Europe/Warsaw, jako DATE. Używamy do PK weekly_briefings (lokalny tydzień, nie UTC).';

-- ──────────────────────────────────────────────────────────────────────────
-- 4. RPC: compute_weekly_briefing — buduje JSONB payload
--    SECURITY DEFINER, ale parametr p_user_id JEST obowiązkowy
--    (callable z RPC `ensure_weekly_briefing` lub z batch cron RPC).
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.compute_weekly_briefing(
  p_user_id UUID,
  p_week_start DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start_ts TIMESTAMPTZ;
  v_week_end_ts   TIMESTAMPTZ;
  v_classes       JSONB;
  v_changes       JSONB;
  v_announcements JSONB;
  v_events        JSONB;
  v_next_exam     JSONB;
BEGIN
  v_week_start_ts := (p_week_start::TIMESTAMP) AT TIME ZONE 'Europe/Warsaw';
  v_week_end_ts   := v_week_start_ts + INTERVAL '7 days';

  -- Plan zajęć z tego tygodnia (counts + first/last).
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'hours', COALESCE(SUM(EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 3600.0), 0),
    'days_with_classes', COUNT(DISTINCT (e.start_time AT TIME ZONE 'Europe/Warsaw')::DATE),
    'cancelled', COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE e.lecturer_key IS NOT NULL
        AND a.lecturer_name IS NOT NULL
        AND a.status = 'cancelled'
        AND public.lecturer_name_key(a.lecturer_name) = e.lecturer_key
        AND a.created_at >= v_week_start_ts - INTERVAL '7 days'
        AND a.created_at < v_week_end_ts
    )),
    'first', (
      SELECT jsonb_build_object(
        'summary', e2.summary,
        'start_time', e2.start_time,
        'end_time', e2.end_time,
        'location', e2.location,
        'lecturer_name', e2.lecturer_name
      )
      FROM public.user_timetable_entries e2
      WHERE e2.user_id = p_user_id
        AND e2.start_time >= v_week_start_ts
        AND e2.start_time < v_week_end_ts
      ORDER BY e2.start_time ASC
      LIMIT 1
    ),
    'last', (
      SELECT jsonb_build_object(
        'summary', e3.summary,
        'start_time', e3.start_time,
        'end_time', e3.end_time,
        'location', e3.location,
        'lecturer_name', e3.lecturer_name
      )
      FROM public.user_timetable_entries e3
      WHERE e3.user_id = p_user_id
        AND e3.start_time >= v_week_start_ts
        AND e3.start_time < v_week_end_ts
      ORDER BY e3.start_time DESC
      LIMIT 1
    )
  ) INTO v_classes
  FROM public.user_timetable_entries e
  WHERE e.user_id = p_user_id
    AND e.start_time >= v_week_start_ts
    AND e.start_time < v_week_end_ts;

  -- Zmiany w planie ze świata calendar_entries (kindy planu) ograniczone
  -- do wykładowców subskrybowanych przez usera — bo bez tego mielibyśmy
  -- noise z całej uczelni.
  SELECT COALESCE(jsonb_agg(row_data ORDER BY starts_at), '[]'::jsonb) INTO v_changes
  FROM (
    SELECT
      ce.starts_at,
      jsonb_build_object(
        'id', ce.id,
        'kind', ce.kind,
        'title', ce.title,
        'description', LEFT(COALESCE(ce.description, ''), 280),
        'starts_at', ce.starts_at,
        'ends_at', ce.ends_at,
        'all_day', ce.all_day,
        'location', ce.location,
        'lecturer_name', ce.lecturer_name,
        'source_announcement_id', ce.source_announcement_id
      ) AS row_data
    FROM public.calendar_entries ce
    JOIN public.lecturer_subscriptions ls
      ON ls.user_id = p_user_id
      AND ls.lecturer_key = ce.lecturer_key
    WHERE ce.kind IN ('lecturer_absence','class_cancelled','class_remote','class_rescheduled','duty_change')
      AND ce.starts_at < v_week_end_ts
      AND ce.ends_at >= v_week_start_ts
    LIMIT 25
  ) sub;

  -- Komunikaty z ostatnich 7 dni od subskrybowanych wykładowców
  -- (ostatnie 8 wpisów posortowane od najnowszego).
  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb) INTO v_announcements
  FROM (
    SELECT
      a.created_at,
      jsonb_build_object(
        'id', a.id,
        'lecturer_name', a.lecturer_name,
        'body', LEFT(a.body, 320),
        'status', a.status,
        'department', a.department,
        'created_at', a.created_at
      ) AS row_data
    FROM public.announcements a
    JOIN public.lecturer_subscriptions ls
      ON ls.user_id = p_user_id
      AND ls.lecturer_key = public.lecturer_name_key(a.lecturer_name)
    WHERE a.created_at >= v_week_start_ts - INTERVAL '7 days'
      AND a.created_at < v_week_end_ts
    ORDER BY a.created_at DESC
    LIMIT 8
  ) sub;

  -- Eventy oficjalne UJ w tym tygodniu (z calendar_entries kind='official_event').
  SELECT COALESCE(jsonb_agg(row_data ORDER BY starts_at), '[]'::jsonb) INTO v_events
  FROM (
    SELECT
      ce.starts_at,
      jsonb_build_object(
        'id', ce.id,
        'title', ce.title,
        'description', LEFT(COALESCE(ce.description, ''), 280),
        'starts_at', ce.starts_at,
        'ends_at', ce.ends_at,
        'all_day', ce.all_day,
        'location', ce.location,
        'department', ce.department,
        'source_official_event_id', ce.source_official_event_id
      ) AS row_data
    FROM public.calendar_entries ce
    WHERE ce.kind = 'official_event'
      AND ce.starts_at < v_week_end_ts
      AND ce.ends_at >= v_week_start_ts
    LIMIT 12
  ) sub;

  -- Najbliższy deadline / egzamin (kind='deadline' z calendar_entries,
  -- ograniczone do następnych 60 dni). Z aktywnego horyzontu, nawet jeśli
  -- nie wpada w sam tydzień — żeby briefing odliczał egzaminy.
  SELECT to_jsonb(sub) INTO v_next_exam
  FROM (
    SELECT
      ce.id,
      ce.title,
      ce.starts_at,
      ce.location,
      GREATEST(0, EXTRACT(DAY FROM (ce.starts_at - v_week_start_ts))::INT) AS days_away
    FROM public.calendar_entries ce
    WHERE ce.kind = 'deadline'
      AND ce.starts_at >= v_week_start_ts
      AND ce.starts_at < v_week_start_ts + INTERVAL '60 days'
    ORDER BY ce.starts_at ASC
    LIMIT 1
  ) sub;

  RETURN jsonb_build_object(
    'schema_version', 1,
    'week_start', p_week_start,
    'week_end', (p_week_start + INTERVAL '6 days')::DATE,
    'classes', COALESCE(v_classes, jsonb_build_object('total', 0, 'hours', 0, 'days_with_classes', 0, 'cancelled', 0, 'first', NULL, 'last', NULL)),
    'changes', COALESCE(v_changes, '[]'::jsonb),
    'announcements_from_subscribed', COALESCE(v_announcements, '[]'::jsonb),
    'official_events', COALESCE(v_events, '[]'::jsonb),
    'next_exam', v_next_exam
  );
END;
$$;

COMMENT ON FUNCTION public.compute_weekly_briefing(UUID, DATE) IS
  'Buduje JSONB payload tygodniowego briefingu (plan + zmiany + komunikaty + eventy + next exam). STABLE i SECURITY DEFINER — wywoływana z ensure_weekly_briefing i batch cron.';

-- ──────────────────────────────────────────────────────────────────────────
-- 5. RPC: ensure_weekly_briefing — lazy generation dla aktualnie zalogowanego
--    Klient woła to przy wejściu na /briefing albo z widget na feedzie.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_weekly_briefing(p_week_start DATE DEFAULT NULL)
RETURNS public.weekly_briefings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_week DATE := COALESCE(p_week_start, public.warsaw_week_start());
  v_payload JSONB;
  v_briefing public.weekly_briefings;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is NULL — must be called by an authenticated user';
  END IF;

  -- Sprawdź czy briefing już istnieje (i nie jest świeży? — zawsze zwracamy
  -- istniejący wiersz; aktualizację robi cron lub admin).
  SELECT * INTO v_briefing
  FROM public.weekly_briefings
  WHERE user_id = v_user_id AND week_start = v_week;

  IF FOUND THEN
    RETURN v_briefing;
  END IF;

  v_payload := public.compute_weekly_briefing(v_user_id, v_week);

  INSERT INTO public.weekly_briefings (user_id, week_start, payload)
  VALUES (v_user_id, v_week, v_payload)
  ON CONFLICT (user_id, week_start) DO UPDATE
    SET payload = EXCLUDED.payload,
        generated_at = NOW()
  RETURNING * INTO v_briefing;

  -- Notyfikacja 1:1 z briefingiem. ON CONFLICT (user_id, briefing_id)
  -- gwarantuje że re-generacja w tym samym tygodniu nie zaspamuje skrzynki.
  INSERT INTO public.notifications (user_id, actor_id, type, briefing_id)
  VALUES (v_user_id, NULL, 'weekly_briefing', v_briefing.id)
  ON CONFLICT (user_id, briefing_id) WHERE briefing_id IS NOT NULL DO NOTHING;

  RETURN v_briefing;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_weekly_briefing(DATE) TO authenticated;

COMMENT ON FUNCTION public.ensure_weekly_briefing(DATE) IS
  'Lazy-genera briefing dla auth.uid() na zadany tydzień (default: bieżący Europe/Warsaw). Idempotentne — wraca istniejący wiersz albo tworzy nowy + notyfikację.';

-- ──────────────────────────────────────────────────────────────────────────
-- 6. RPC: generate_weekly_briefings_for_week — batch dla crona
--    Wywoływane przez serwerowy klucz (service_role) z Vercel cronjoba.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_weekly_briefings_for_week(
  p_week_start DATE DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week DATE := COALESCE(p_week_start, public.warsaw_week_start());
  v_week_start_ts TIMESTAMPTZ;
  v_week_end_ts TIMESTAMPTZ;
  v_user RECORD;
  v_payload JSONB;
  v_briefing_id BIGINT;
  v_count INT := 0;
BEGIN
  v_week_start_ts := (v_week::TIMESTAMP) AT TIME ZONE 'Europe/Warsaw';
  v_week_end_ts := v_week_start_ts + INTERVAL '7 days';

  -- Targetujemy userów z aktywnym planem na ten tydzień LUB z subskrypcjami
  -- wykładowców (bez planu też się przyda briefing z komunikatami).
  FOR v_user IN
    SELECT DISTINCT user_id
    FROM (
      SELECT user_id
      FROM public.user_timetable_entries
      WHERE start_time >= v_week_start_ts AND start_time < v_week_end_ts
      UNION
      SELECT user_id FROM public.lecturer_subscriptions
    ) src
  LOOP
    v_payload := public.compute_weekly_briefing(v_user.user_id, v_week);

    INSERT INTO public.weekly_briefings (user_id, week_start, payload)
    VALUES (v_user.user_id, v_week, v_payload)
    ON CONFLICT (user_id, week_start) DO UPDATE
      SET payload = EXCLUDED.payload,
          generated_at = NOW()
    RETURNING id INTO v_briefing_id;

    INSERT INTO public.notifications (user_id, actor_id, type, briefing_id)
    VALUES (v_user.user_id, NULL, 'weekly_briefing', v_briefing_id)
    ON CONFLICT (user_id, briefing_id) WHERE briefing_id IS NOT NULL DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.generate_weekly_briefings_for_week(DATE) IS
  'Batch generator briefingów dla wszystkich userów z aktywnym planem na ten tydzień LUB subskrypcjami. Wywoływany z Vercel cronjoba przez service_role.';

-- Brak GRANTu dla authenticated — batch ma być wołany tylko serwerowo
-- (service_role bypassuje GRANT i RLS, więc nie potrzebuje EXEC).
REVOKE EXECUTE ON FUNCTION public.generate_weekly_briefings_for_week(DATE) FROM PUBLIC;
