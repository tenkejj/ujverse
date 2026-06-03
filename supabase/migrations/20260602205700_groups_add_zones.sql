-- Dodaje 4 nowe strefy do `public.groups` (siatka 3×3 na `/group`).
-- Slugi 1:1 z `OFFICIAL_TAGS` w `src/services/TagService.ts`.
--
-- Bez tego wpisu klik w kafelek na `/group` prowadzi do `GroupView`,
-- który przez `GroupService.getGroupBySlug` nie znajduje wiersza
-- i wyświetla "Nie znaleziono grupy dla tego tagu.".

INSERT INTO public.groups (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000006', 'Nauka',      'nauka'),
  ('00000000-0000-0000-0000-000000000007', 'Sport',      'sport'),
  ('00000000-0000-0000-0000-000000000008', 'Kultura',    'kultura'),
  ('00000000-0000-0000-0000-000000000009', 'Inicjatywy', 'inicjatywy')
ON CONFLICT (slug) DO NOTHING;
