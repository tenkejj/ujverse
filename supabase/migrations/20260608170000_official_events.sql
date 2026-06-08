-- Oficjalne wydarzenia uczelniane scrapowane przez serverless cron
-- (`api/scrape-uj-events.ts`). Front czyta wyłącznie z tej tabeli — bez
-- proxy w Vite, bez publicznych CORS-proxy. Upsert po `external_id`.

CREATE TABLE IF NOT EXISTS public.official_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  category TEXT NOT NULL DEFAULT 'Oficjalne',
  location TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  faculty TEXT NOT NULL CHECK (faculty IN ('WZiKS', 'Uniwersytet Jagielloński')),
  source_name TEXT NOT NULL,
  event_url TEXT NOT NULL,
  image_url TEXT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS official_events_date_idx ON public.official_events (date DESC);
CREATE INDEX IF NOT EXISTS official_events_faculty_idx ON public.official_events (faculty);

ALTER TABLE public.official_events ENABLE ROW LEVEL SECURITY;

-- Drop+create idempotentnie (re-runy migracji).
DROP POLICY IF EXISTS "official_events_select_authenticated" ON public.official_events;
CREATE POLICY "official_events_select_authenticated"
  ON public.official_events FOR SELECT
  TO authenticated
  USING (true);

-- Brak polityk INSERT/UPDATE/DELETE — modyfikacje wyłącznie przez service_role
-- (Vercel serverless używa `SUPABASE_SERVICE_ROLE_KEY`, RLS bypass).

-- Trigger: aktualizuj `updated_at` przy każdym update.
CREATE OR REPLACE FUNCTION public.touch_official_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS official_events_touch_updated_at ON public.official_events;
CREATE TRIGGER official_events_touch_updated_at
  BEFORE UPDATE ON public.official_events
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_official_events_updated_at();
