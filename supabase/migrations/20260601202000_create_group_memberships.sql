-- Smart Tag Routing — persistencja: posty są łączone z grupami przez tagi.
-- Konsument: src/services/TagRouter.ts (uruchamiany z PostService.createPost).
--
-- Tabela `public.groups` nie istniała w migracjach na disku — tworzona warunkowo
-- (IF NOT EXISTS), z RLS + public read, zgodnie z konwencją z poprzednich
-- migracji (np. 20260514140000_notifications_table_rls.sql).

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Grupy (warunkowo)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON public.groups;
CREATE POLICY "Public read access"
  ON public.groups FOR SELECT
  USING (true);

-- Seedy dla placeholderów UUID z src/lib/tagRoutes.ts. Idempotentne — wymień
-- ID/nazwy na realne, gdy produkt finalizuje listę grup.
INSERT INTO public.groups (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Ankiety',     'ankiety'),
  ('00000000-0000-0000-0000-000000000002', 'Ogłoszenia',  'ogloszenia'),
  ('00000000-0000-0000-0000-000000000003', 'Wydarzenia',  'wydarzenia'),
  ('00000000-0000-0000-0000-000000000004', 'Pomoc',       'pomoc'),
  ('00000000-0000-0000-0000-000000000005', 'Praca',       'praca')
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Relacja N:N post ↔ grupa
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.group_memberships (
  group_id UUID NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  post_id BIGINT NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT group_memberships_pkey PRIMARY KEY (group_id, post_id)
);

-- PK (group_id, post_id) jest btree → służy także lookupom po samym group_id
-- (left-prefix). Reverse lookup „w jakich grupach jest ten post?" wymaga
-- osobnego indeksu na post_id.
CREATE INDEX IF NOT EXISTS group_memberships_post_id_idx
  ON public.group_memberships (post_id);

ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON public.group_memberships;
CREATE POLICY "Public read access"
  ON public.group_memberships FOR SELECT
  USING (true);

-- INSERT policy nie była wprost w briefie, ale bez niej TagRouter (działający
-- po stronie klienta z anon/authenticated JWT) dostanie 42501 (permission
-- denied) zamiast 42P01. Ograniczenie: tylko właściciel posta może go dopiąć
-- do grupy — chroni przed cudzymi insertami z konsoli przeglądarki.
-- Wzorzec `(SELECT auth.uid())` jest preferowany przez Supabase ze względu na
-- inicjalizację raz na zapytanie (RLS performance).
DROP POLICY IF EXISTS group_memberships_insert_post_owner ON public.group_memberships;
CREATE POLICY group_memberships_insert_post_owner
  ON public.group_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = group_memberships.post_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

-- DELETE świadomie pomijane — kasowanie posta kaskaduje przez FK
-- (ON DELETE CASCADE), więc samodzielnych DELETE'ów się nie spodziewamy do
-- czasu adminowych narzędzi moderacji.
