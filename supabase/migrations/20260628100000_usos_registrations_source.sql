-- =====================================================================
-- UJverse — USOS Registrations: AI source tracking
-- =====================================================================
-- Drugi wątek funkcji USOS Registrations: AI agent (Groq) czyta nowe
-- `announcements` (komunikaty wydziałowe ze scrapera ISI / WZiKS / etc.)
-- i wyciąga z nich strukturalne dane o rejestracjach USOS. Wyniki
-- trafiają do `usos_registrations` z `source_announcement_id` wskazującym
-- na źródło — żeby:
--   1. Avoid duplicates: jeden announcement → max jedna rejestracja
--   2. UI mogło pokazać badge "źródło: ogłoszenie wydziałowe" + link
--   3. Admin mógł audytować decyzje AI (jeśli wyciągnie błędnie)
--
-- Plus: flaga `usos_extraction_attempted_at` na `announcements` żeby
-- nie powtarzać Groq calls — raz przeanalizowane ogłoszenie nigdy więcej
-- nie idzie do LLM (oszczędność quoty + idempotencja crona).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. usos_registrations: source tracking
-- ---------------------------------------------------------------------
alter table public.usos_registrations
  add column if not exists source_announcement_id uuid
    references public.announcements(id) on delete set null;

alter table public.usos_registrations
  add column if not exists source_label text
    check (source_label is null or char_length(source_label) <= 100);

comment on column public.usos_registrations.source_announcement_id is
  'Jeśli wpis powstał automatycznie z ogłoszenia wydziałowego — FK do tego ogłoszenia. NULL = wpis community-driven lub seed.';

comment on column public.usos_registrations.source_label is
  'Krótka etykieta źródła: "AI · ISI/WZiKS", "seed" lub null dla community. Pomaga w UI badge.';

-- UNIQUE: jeden announcement = max jedna rejestracja (idempotencja
-- extractora; partial żeby NULL-e nie kolidowały dla community wpisów).
create unique index if not exists usos_registrations_source_announcement_uidx
  on public.usos_registrations (source_announcement_id)
  where source_announcement_id is not null;

-- ---------------------------------------------------------------------
-- 2. announcements: usos extraction attempted flag
-- ---------------------------------------------------------------------
-- Świadomie OSOBNA flaga od `extraction_attempted_at` (calendar pass).
-- Dwie różne ekstrakcje, dwa różne prompty, dwa różne tracki — żeby
-- recompute jednego nie wymuszał recompute drugiego. Cron USOS może
-- iść z innym schedule'm niż cron calendar.
alter table public.announcements
  add column if not exists usos_extraction_attempted_at timestamptz;

comment on column public.announcements.usos_extraction_attempted_at is
  'Kiedy ostatnio extract-usos-registrations.ts próbował wyciągnąć rejestrację USOS. NULL = nie próbowano. NOT NULL = już sprawdzone (pozytywnie lub negatywnie — `source_announcement_id` w usos_registrations rozstrzyga).';

-- Index do efektywnego cron query: WHERE usos_extraction_attempted_at IS NULL
-- ORDER BY created_at DESC LIMIT 20. Partial index na NULL — typowy
-- pattern dla "queue" tabel.
create index if not exists announcements_usos_pending_idx
  on public.announcements (created_at desc)
  where usos_extraction_attempted_at is null;
