-- ──────────────────────────────────────────────────────────────────────────
-- UJ buildings — koordynaty correction.
--
-- Pierwszy seed w `20260616100000_uj_buildings_rooms.sql` miał bardzo
-- nieprecyzyjne lat/lng dla większości budynków (off 100-500m). Wykryte
-- podczas wdrażania mapy 3D — Overpass/Nominatim zwracały footprinty
-- które fizycznie były gdzie indziej niż wskazywał seed.
--
-- Ta migracja AKTUALIZUJE lat/lng do wartości potwierdzonych przez
-- Nominatim (`addressdetails=1`) i OSM relations/ways. Wartości są
-- centroidami zwróconymi przez `nominatim.openstreetmap.org/search?q=…`
-- z weryfikacją w `scripts/fetch-uj-footprints.ts` (każdy budynek
-- znaleziony z `match_strategy=osm_id` po tej zmianie).
--
-- Bez tej migracji "Najbliżej Cię" + dystans w karcie budynku wskazują
-- na złe miejsca i flyTo kamery na mapie ląduje obok prawdziwego
-- budynku.
-- ──────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Śródmieście ─────────────────────────────────────────────────────────
UPDATE public.uj_buildings SET lat = 50.061190, lng = 19.933530
  WHERE id = 'collegium-novum';
UPDATE public.uj_buildings SET lat = 50.061563, lng = 19.933409
  WHERE id = 'collegium-maius';
UPDATE public.uj_buildings SET lat = 50.063078, lng = 19.925139
  WHERE id = 'auditorium-maximum';

-- ── Kampus 600-lecia (największe poprawki) ──────────────────────────────
-- WMI Łojasiewicza 6 — poprzednio (50.029400, 19.901900), real ~+400m.
UPDATE public.uj_buildings SET lat = 50.030599, lng = 19.907399
  WHERE id = 'lojasiewicza-6';
-- WFAIS Łojasiewicza 11 — poprzednio (50.029900, 19.902800).
UPDATE public.uj_buildings SET lat = 50.029072, lng = 19.904907
  WHERE id = 'lojasiewicza-11';
-- WB Gronostajowa 9 — poprzednio (50.030100, 19.903700), real ~+400m SW.
UPDATE public.uj_buildings SET lat = 50.027385, lng = 19.900719
  WHERE id = 'gronostajowa-9';
-- WCh Gronostajowa 2 — drobna korekta.
UPDATE public.uj_buildings SET lat = 50.029092, lng = 19.904106
  WHERE id = 'gronostajowa-2';
-- WGG Gronostajowa 3a — Instytut Botaniki centroid.
UPDATE public.uj_buildings SET lat = 50.027436, lng = 19.903726
  WHERE id = 'gronostajowa-3a';
-- WZiKS Łojasiewicza 4 — poprzednio (50.029700, 19.901300), real ~+550m E.
UPDATE public.uj_buildings SET lat = 50.030279, lng = 19.908995
  WHERE id = 'lojasiewicza-4';

-- ── al. Mickiewicza / Ingardena ─────────────────────────────────────────
-- WFil al. Mickiewicza 9-11 = Collegium Paderevianum (way 39393936).
UPDATE public.uj_buildings SET lat = 50.062756, lng = 19.924494
  WHERE id = 'mickiewicza-9-11';
-- WFz/Instytut Psychologii Ingardena 6.
UPDATE public.uj_buildings SET lat = 50.061626, lng = 19.920077
  WHERE id = 'ingardena-6';

-- ── Gołębia ─────────────────────────────────────────────────────────────
UPDATE public.uj_buildings SET lat = 50.061365, lng = 19.932980
  WHERE id = 'golebia-13';
UPDATE public.uj_buildings SET lat = 50.060735, lng = 19.934369
  WHERE id = 'golebia-16';

-- ── WPiA Bracka 12 ──────────────────────────────────────────────────────
UPDATE public.uj_buildings SET lat = 50.059714, lng = 19.936322
  WHERE id = 'bracka-12';

-- ── WSMiP Reymonta 4 ────────────────────────────────────────────────────
UPDATE public.uj_buildings SET lat = 50.063577, lng = 19.920147
  WHERE id = 'reymonta-4';

-- ── Biblioteka Jagiellońska Mickiewicza 22 — poprzednio off ~330m ──────
UPDATE public.uj_buildings SET lat = 50.061438, lng = 19.922505
  WHERE id = 'mickiewicza-22-bj';

-- ── SWFiS Piastowska 26 — poprzednio off ~480m ─────────────────────────
UPDATE public.uj_buildings SET lat = 50.066168, lng = 19.901782
  WHERE id = 'piastowska-26';

-- ── CM UJ Św. Anny 12 — drobna korekta ─────────────────────────────────
UPDATE public.uj_buildings SET lat = 50.061600, lng = 19.936700
  WHERE id = 'sw-anny-12';

COMMIT;
