-- RSVP na wydarzenia (user-events i oficjalne UJ events razem).
--
-- `event_id` jest TEXT (nie UUID), bo `UJEvent.id` po stronie frontu jest
-- mieszanką:
--   • UUID z `public.events` (wydarzenia tworzone przez userów)
--   • `ext:ingest:<external_id>` z `EventIngestor` (oficjalne UJ z scrapera)
--   • `local-<timestamp>` (offline draft fallback)
-- Brak FK do `events`/`official_events`, bo żadna z tych tabel nie pokrywa
-- wszystkich trzech wariantów.
--
-- `user_id` ma FK do `public.profiles` (wzorzec z `follows`, `likes`,
-- `comment_likes`) — pozwala na automatic Supabase relationship hint
-- `select(..., profiles(...))` przy ładowaniu listy uczestników w UI.
--
-- RSVP toggle = INSERT lub DELETE — brak UPDATE.

CREATE TABLE IF NOT EXISTS public.event_rsvps (
  event_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_rsvps_pkey PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_rsvps_event_id_idx ON public.event_rsvps (event_id);
CREATE INDEX IF NOT EXISTS event_rsvps_user_id_idx ON public.event_rsvps (user_id);
CREATE INDEX IF NOT EXISTS event_rsvps_event_created_idx ON public.event_rsvps (event_id, created_at);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- SELECT: każdy zalogowany widzi listę uczestników dowolnego wydarzenia
-- (motywacja produktowa: użytkownik chce wiedzieć kto jeszcze idzie).
DROP POLICY IF EXISTS "event_rsvps_select_authenticated" ON public.event_rsvps;
CREATE POLICY "event_rsvps_select_authenticated"
  ON public.event_rsvps FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: user może zapisać WYŁĄCZNIE siebie.
DROP POLICY IF EXISTS "event_rsvps_insert_own" ON public.event_rsvps;
CREATE POLICY "event_rsvps_insert_own"
  ON public.event_rsvps FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- DELETE: user może wycofać WYŁĄCZNIE swój RSVP.
DROP POLICY IF EXISTS "event_rsvps_delete_own" ON public.event_rsvps;
CREATE POLICY "event_rsvps_delete_own"
  ON public.event_rsvps FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Realtime: subskrybcja INSERT/DELETE w `useEvents` pozwala innym widzieć
-- na żywo kto się dopisuje/wypisuje (count + lista uczestników).
-- DO instead of plain ALTER bo `supabase_realtime` może już zawierać tabelę.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_rsvps'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rsvps;
  END IF;
END
$$;
