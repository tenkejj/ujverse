-- Źródło komunikatu (np. scraper ISI UJ)
ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS source TEXT;
