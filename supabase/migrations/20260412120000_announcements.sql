-- Komunikaty akademickie / ogłoszenia wydziałowe (odczyt dla zalogowanych)
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT,
  lecturer_name TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('cancelled', 'remote', 'duty')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_created_at_idx ON public.announcements (created_at DESC);
CREATE INDEX IF NOT EXISTS announcements_department_idx ON public.announcements (department);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_select_authenticated"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (true);
