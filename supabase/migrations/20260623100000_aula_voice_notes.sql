-- Aula voice notes drop: kolumna `duration_seconds` w `cohort_message_attachments`
-- + rozszerzenie whitelisty MIME w buckecie `aula-files` o nagrania głosowe.
-- Kolumna jest nullowalna — istniejące pliki (image/pdf/docs) zachowują NULL,
-- a klient wypełnia ją tylko dla nagrań audio (i potencjalnie video w przyszłości).
--
-- MIME audio/* dodajemy SELEKTYWNIE — `audio/webm` (MediaRecorder na Chromium/Firefox),
-- `audio/mp4` (Safari iOS — MediaRecorder z mimeType "audio/mp4"), `audio/ogg`
-- (Firefox fallback) i `audio/mpeg` (na wypadek konwersji client-side w przyszłości).
-- NIE zezwalamy na całe `audio/*` żeby uniknąć egzotycznych formatów które
-- przeglądarki gorzej renderują.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Kolumna duration_seconds
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cohort_message_attachments
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NULL;

-- Soft constraint — voice notes są capowane na 5 minut (300s) w UI, więc
-- zostawiamy generous górną granicę 3600 (1h) na wypadek długich nagrań
-- video w przyszłości. NULL jest zawsze ok (legacy + non-audio).
ALTER TABLE public.cohort_message_attachments
  DROP CONSTRAINT IF EXISTS cohort_message_attachments_duration_ok;

ALTER TABLE public.cohort_message_attachments
  ADD CONSTRAINT cohort_message_attachments_duration_ok
  CHECK (duration_seconds IS NULL OR (duration_seconds > 0 AND duration_seconds <= 3600));

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Bucket `aula-files`: rozszerz allowed_mime_types o nagrania audio.
--    UPSERT z DO UPDATE (jak w oryginalnej migracji 20260612090000) —
--    zachowujemy size_limit i public flag.
-- ──────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'aula-files',
  'aula-files',
  false,
  26214400, -- 25 MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'text/plain',
    'text/markdown',
    'application/zip',
    'audio/webm',
    'audio/mp4',
    'audio/ogg',
    'audio/mpeg'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Sanity: tabela już REPLICA IDENTITY FULL z poprzedniej migracji,
--    więc Realtime na UPDATE załączników (gdy chcielibyśmy lazy-fill
--    duration) by działał z oryginalnymi rowami. Nic nie zmieniamy.
-- ──────────────────────────────────────────────────────────────────────────
