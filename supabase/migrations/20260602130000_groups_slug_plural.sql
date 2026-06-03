-- Sync `public.groups.slug` z hashtagami w UI (liczba mnoga).
--
-- Tło: migracja `20260602120000_post_tags_group_trigger.sql` zmieniła slugi
-- na liczbę pojedynczą (ankieta / ogloszenie / wydarzenie), ale UI (TagService
-- → GroupNav) używa form mnogich (#ankiety / #ogloszenia / #wydarzenia).
-- Skutek: klik w sidebarze → `/group/ankiety` → `GroupService.getGroupBySlug`
-- → 0 wierszy → komunikat „Nie znaleziono grupy dla tego tagu.".
--
-- Naprawa: aligniujemy DB do UI (kolejność krytyczna ze względu na trigger
-- `on_post_created_or_updated`).

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Rename slugów w `public.groups` (id pozostaje, FK z `group_memberships`
--    referuje group_id, więc członkostwa nie są zerwane).
-- ──────────────────────────────────────────────────────────────────────────

UPDATE public.groups
SET slug = 'ankiety'
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND slug = 'ankieta';

UPDATE public.groups
SET slug = 'ogloszenia'
WHERE id = '00000000-0000-0000-0000-000000000002'
  AND slug = 'ogloszenie';

UPDATE public.groups
SET slug = 'wydarzenia'
WHERE id = '00000000-0000-0000-0000-000000000003'
  AND slug = 'wydarzenie';

-- pomoc i praca już mają poprawne slugi (singularis == nazwa hashtagu).

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Backfill `public.posts.tags`: zamiana legacy form pojedynczych
--    na mnogie, z dedupem (na wypadek gdyby post miał już obie wersje).
--    UPDATE na kolumnie `tags` automatycznie odpala trigger
--    `on_post_created_or_updated`, który zsynchronizuje `group_memberships`.
-- ──────────────────────────────────────────────────────────────────────────

UPDATE public.posts AS p
SET tags = sub.new_tags
FROM (
  SELECT
    p2.id,
    ARRAY(
      SELECT DISTINCT
        CASE lower(btrim(tag))
          WHEN 'ankieta'    THEN 'ankiety'
          WHEN 'ogloszenie' THEN 'ogloszenia'
          WHEN 'wydarzenie' THEN 'wydarzenia'
          ELSE tag
        END
      FROM unnest(p2.tags) AS t(tag)
    ) AS new_tags
  FROM public.posts AS p2
  WHERE p2.tags && ARRAY['ankieta', 'ogloszenie', 'wydarzenie']::text[]
) AS sub
WHERE p.id = sub.id;
