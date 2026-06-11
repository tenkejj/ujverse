-- Sale UJ rebrand:
--   1) cohort_channels += `kind` text (typ zajęć: wyk/cw/lab/sem/proj/inne).
--   2) CHECK constraint na 6-wartościowy enum (ASCII-only, mapowanie ćw <-> cw
--      po stronie klienta — chroni przed niespodziankami collation).
--   3) Default `inne` dla bezpiecznego ADD COLUMN na istniejących wierszach.
--   4) Index `(cohort_id, kind) WHERE archived_at IS NULL` — pod przyszłe
--      "pokaż tylko sale typu lab" filtry; tani, partial.
--
-- Migracja idempotentna (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS).
--
-- UI: "Sala" zamiast "Kanał", pill z typem zamiast `#`. Slug system zostaje
-- (URL key), Sala główna (NULL channel_id) jest wirtualna i NIE ma kind.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Kolumna kind + CHECK
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cohort_channels
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'inne';

-- DROP + ADD CHECK żeby idempotentnie wymusić dokładnie tę listę typów.
-- (ADD COLUMN IF NOT EXISTS nie ponawia CHECK przy re-runie.)
ALTER TABLE public.cohort_channels
  DROP CONSTRAINT IF EXISTS cohort_channels_kind_check;

ALTER TABLE public.cohort_channels
  ADD CONSTRAINT cohort_channels_kind_check
    CHECK (kind IN ('wyk', 'cw', 'lab', 'sem', 'proj', 'inne'));

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Partial index pod przyszły filtr "pokaż tylko sale typu X"
-- ──────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS cohort_channels_cohort_kind_idx
  ON public.cohort_channels (cohort_id, kind)
  WHERE archived_at IS NULL;
