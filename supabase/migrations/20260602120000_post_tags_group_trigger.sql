-- Automatyczne przypisywanie postów do grup po polu `posts.tags`.
-- Źródło prawdy: `public.groups.slug` = znormalizowany tag (lowercase, trim).
-- Konsument UI: GroupService / GroupNav (SELECT z `groups`).
-- Zastępuje klientowski TagRouter i mapę w tagRoutes.ts.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Slugi grup = nazwy tagów (nie liczba mnoga)
-- ──────────────────────────────────────────────────────────────────────────

UPDATE public.groups SET slug = 'ankieta',    name = 'Ankiety'     WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE public.groups SET slug = 'ogloszenie', name = 'Ogłoszenia'  WHERE id = '00000000-0000-0000-0000-000000000002';
UPDATE public.groups SET slug = 'wydarzenie', name = 'Wydarzenia' WHERE id = '00000000-0000-0000-0000-000000000003';
UPDATE public.groups SET slug = 'pomoc',      name = 'Pomoc'       WHERE id = '00000000-0000-0000-0000-000000000004';
UPDATE public.groups SET slug = 'praca',      name = 'Praca'       WHERE id = '00000000-0000-0000-0000-000000000005';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Trigger: sync group_memberships ↔ posts.tags
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_post_tags_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Usuń członkostwa dla grup, które nie pasują do aktualnych tagów posta.
  DELETE FROM public.group_memberships AS gm
  WHERE gm.post_id = NEW.id
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(COALESCE(NEW.tags, '{}'::text[])) AS u(tag)
      INNER JOIN public.groups AS g ON g.slug = lower(btrim(u.tag))
      WHERE btrim(u.tag) <> ''
        AND g.id = gm.group_id
    );

  -- Dopnij post do każdej grupy, której slug = tag (idempotentnie).
  INSERT INTO public.group_memberships (group_id, post_id)
  SELECT DISTINCT g.id, NEW.id
  FROM unnest(COALESCE(NEW.tags, '{}'::text[])) AS u(tag)
  INNER JOIN public.groups AS g ON g.slug = lower(btrim(u.tag))
  WHERE btrim(u.tag) <> ''
  ON CONFLICT ON CONSTRAINT group_memberships_pkey DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_post_tags_update() IS
  'AFTER INSERT/UPDATE OF tags on posts: sync group_memberships by groups.slug = tag.';

DROP TRIGGER IF EXISTS on_post_created_or_updated ON public.posts;

CREATE TRIGGER on_post_created_or_updated
  AFTER INSERT OR UPDATE OF tags ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_tags_update();

COMMENT ON TRIGGER on_post_created_or_updated ON public.posts IS
  'Uruchamia handle_post_tags_update() tylko przy INSERT lub zmianie kolumny tags.';

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Jednorazowy backfill (bez osobnego skryptu)
-- ──────────────────────────────────────────────────────────────────────────

UPDATE public.posts AS p
SET tags = p.tags
WHERE p.tags IS NOT NULL
  AND cardinality(p.tags) > 0;
