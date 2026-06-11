-- Aula files drop: prywatny bucket aula-files + tabela cohort_message_attachments
-- + RLS na storage.objects (folder-based: <cohort_id>/<user_id>/<uuid>-<name>).
--
-- To pierwsza migracja w repo która konfiguruje Supabase Storage przez SQL.
-- Bucket "media" pozostaje legacy poza migracjami; "aula-files" jest w pełni
-- zarządzany tutaj.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Bucket: aula-files (private + size + MIME whitelist)
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
    'application/zip'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Storage RLS: ścieżki w formacie <cohort_id>/<user_id>/<uuid>-<file>
--    storage.foldername(name)[1] = cohort_id (text), [2] = user_id (text).
-- ──────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS aula_files_select_members ON storage.objects;
CREATE POLICY aula_files_select_members
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'aula-files'
    AND EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id::text = (storage.foldername(name))[1]
        AND cm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS aula_files_insert_members ON storage.objects;
CREATE POLICY aula_files_insert_members
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'aula-files'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id::text = (storage.foldername(name))[1]
        AND cm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS aula_files_delete_own ON storage.objects;
CREATE POLICY aula_files_delete_own
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'aula-files'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Tabela cohort_message_attachments
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cohort_message_attachments (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES public.cohort_messages (id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cohort_message_attachments_message_idx
  ON public.cohort_message_attachments (message_id);
CREATE INDEX IF NOT EXISTS cohort_message_attachments_cohort_created_idx
  ON public.cohort_message_attachments (cohort_id, created_at DESC);

ALTER TABLE public.cohort_message_attachments REPLICA IDENTITY FULL;

-- BEFORE INSERT trigger: wypełnij cohort_id z parent cohort_messages (analogicznie
-- do reactions, klient nie musi go znać).
CREATE OR REPLACE FUNCTION public.fill_attachment_cohort_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cohort_id IS NULL THEN
    SELECT cohort_id INTO NEW.cohort_id
    FROM public.cohort_messages
    WHERE id = NEW.message_id;
  END IF;
  IF NEW.cohort_id IS NULL THEN
    RAISE EXCEPTION 'cohort_message_attachments: parent message % not found', NEW.message_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cohort_attachment_insert_fill_cohort ON public.cohort_message_attachments;
CREATE TRIGGER on_cohort_attachment_insert_fill_cohort
  BEFORE INSERT ON public.cohort_message_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_attachment_cohort_id();

-- RLS
ALTER TABLE public.cohort_message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cohort_message_attachments_select_members ON public.cohort_message_attachments;
CREATE POLICY cohort_message_attachments_select_members
  ON public.cohort_message_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_message_attachments.cohort_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS cohort_message_attachments_insert_members ON public.cohort_message_attachments;
CREATE POLICY cohort_message_attachments_insert_members
  ON public.cohort_message_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.cohort_messages cm
      JOIN public.cohort_members mem ON mem.cohort_id = cm.cohort_id
      WHERE cm.id = cohort_message_attachments.message_id
        AND mem.user_id = (SELECT auth.uid())
        -- author wiadomości musi być uploaderem (zabezpiecza przed cudzymi attach'ami
        -- doczepianymi do cudzej wiadomości)
        AND cm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS cohort_message_attachments_delete_own ON public.cohort_message_attachments;
CREATE POLICY cohort_message_attachments_delete_own
  ON public.cohort_message_attachments FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Realtime publication (idempotentnie)
-- ──────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cohort_message_attachments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cohort_message_attachments;
  END IF;
END;
$$;
