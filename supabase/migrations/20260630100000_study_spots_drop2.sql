-- =====================================================================
-- UJverse — Study Spots Drop 2: photo storage + active checkins RPC.
-- =====================================================================
-- Rozszerza /miejsca o:
--   1. Public bucket `study-spots-photos` (foto z miejsc, publicznie czytelne).
--   2. RLS na storage: SELECT all (public), INSERT/DELETE auth (owner-path).
--   3. RPC `get_active_checkins_with_profiles(p_spot_id)` — kto teraz jest na
--      danym spocie + avatary/nazwiska.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Storage bucket — public read, authenticated write w owner-path
-- ---------------------------------------------------------------------
-- Ścieżka: `<spot_id>/<user_id>/<uuid>-<safeName>` — RLS gatuje po segmencie
-- [2] (user_id), spot_id jest informacją że to foto tego konkretnego miejsca.
-- Public=true bo zdjęcia mają być widoczne dla nielogowanych w przyszłości
-- (np. share link). 8MB / foto, tylko obrazki.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'study-spots-photos',
  'study-spots-photos',
  true,
  8388608, -- 8 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 2. RLS na storage.objects
-- ---------------------------------------------------------------------
-- SELECT — publicznie czytelne (bo bucket public; ale dla pewności + RLS)
DROP POLICY IF EXISTS study_spots_photos_select_all ON storage.objects;
CREATE POLICY study_spots_photos_select_all
  ON storage.objects FOR SELECT
  USING (bucket_id = 'study-spots-photos');

-- INSERT — tylko zalogowany może wrzucać, w ścieżce zaczynającej się od
-- jego user_id w drugim segmencie. Spot_id w pierwszym segmencie.
DROP POLICY IF EXISTS study_spots_photos_insert_owner ON storage.objects;
CREATE POLICY study_spots_photos_insert_owner
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'study-spots-photos'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
  );

-- DELETE — tylko właściciel foto może je usunąć (na podstawie segmentu user_id).
DROP POLICY IF EXISTS study_spots_photos_delete_owner ON storage.objects;
CREATE POLICY study_spots_photos_delete_owner
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'study-spots-photos'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
  );

-- ---------------------------------------------------------------------
-- 3. RPC: get_active_checkins_with_profiles(p_spot_id)
-- ---------------------------------------------------------------------
-- Zwraca listę aktywnych check-inów na danym spocie + dane profili
-- (avatar_url, full_name, username) jednym strzałem — DetailModal renderuje
-- avatary "kto teraz tu jest".
-- security invoker: RLS na profiles/study_spot_checkins gatuje dostęp.

CREATE OR REPLACE FUNCTION public.get_active_checkins_with_profiles(p_spot_id uuid)
RETURNS TABLE (
  checkin_id uuid,
  user_id uuid,
  mood text,
  checked_in_at timestamptz,
  expires_at timestamptz,
  full_name text,
  username text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id AS checkin_id,
    c.user_id,
    c.mood,
    c.checked_in_at,
    c.expires_at,
    p.full_name,
    p.username,
    p.avatar_url
  FROM public.study_spot_checkins c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE c.spot_id = p_spot_id
    AND c.checked_out_at IS NULL
    AND c.expires_at > now()
  ORDER BY c.checked_in_at DESC
$$;

COMMENT ON FUNCTION public.get_active_checkins_with_profiles(uuid) IS
  'Active check-ins for a study spot, joined z profiles dla avatarów/nazwisk. Używane przez StudySpotDetailModal → ActiveCheckinsList.';
