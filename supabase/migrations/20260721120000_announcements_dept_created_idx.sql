-- Indeks pod filtr listy komunikatów: `department IN (...)` + `created_at DESC`
-- (AnnouncementsAdapter.fetch z filtrem wydziału po optymalizacji 2026-07-21).

CREATE INDEX IF NOT EXISTS announcements_department_created_at_idx
  ON public.announcements (department, created_at DESC);
