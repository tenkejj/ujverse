-- Cache mianowników nazwisk (Groq) — jeden zapis na unikalny oryginalny ciąg z scrapera
CREATE TABLE IF NOT EXISTS public.lecturer_names_cache (
  original_name TEXT PRIMARY KEY,
  nominative_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lecturer_names_cache_updated_at_idx
  ON public.lecturer_names_cache (updated_at DESC);

ALTER TABLE public.lecturer_names_cache ENABLE ROW LEVEL SECURITY;

-- Odczyt dla zalogowanych (opcjonalnie); zapis tylko przez service role (scraper)
CREATE POLICY "lecturer_names_cache_select_authenticated"
  ON public.lecturer_names_cache FOR SELECT
  TO authenticated
  USING (true);
