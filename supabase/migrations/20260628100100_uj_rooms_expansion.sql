-- ──────────────────────────────────────────────────────────────────────────
-- UJ rooms — expansion seed (160+ nowych sal).
--
-- Pierwszy seed w `20260616100000_uj_buildings_rooms.sql` miał tylko
-- ~30 sal (kilka per budynek) — wystarczająco do MVP search/3D testów,
-- ale za mało żeby user faktycznie mógł znaleźć "swoją" salę.
--
-- Ta migracja dorzuca realistyczne sale dla każdego z 18 budynków UJ
-- zgodnie z lokalnymi konwencjami nazewnictwa:
--
--   WMI:    4-cyfrowy kod, 1. cyfra = piętro (0xxx parter, 1xxx 1.p.)
--   WFAIS:  Skrzydło-piętro-nr (A-101, B-01, A-0-01)
--   WZiKS:  floor.room (0.07, 1.07, 2.07)
--   WB:     A-1-01 (skrzydło-piętro-nr) + nazwane aule
--   WCh:    Nazwane aule (A,B,C) + floor.room
--   WGG:    Skrzydło-piętro-nr (A-0-04, B-0-01)
--   Starówka (CN, CM, WFil, WH, WPol, WPiA, WSMiP, WFz, BJ):
--           Krótkie numery 17/23/52 + nazwane aule reprezentacyjne
--   SWFiS:  Nazwane (Hala, Siłownia, Basen…)
--   Aud.Max:Nazwane (Aula Duża/Średnia/Mała/Tischnera) + sale konferencyjne
--
-- `ON CONFLICT (building_id, code) DO NOTHING` — wpisy z poprzedniego
-- seedu zostają, nowe są dodane.
--
-- Capacity oszacowane — duże aule ~200-1100, średnie sale wykładowe
-- 60-150, ćwiczeniowe 20-50, pracownie/seminaryjne 15-30.
-- ──────────────────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity, notes)
VALUES
  -- ── Auditorium Maximum (już 4: Aula Duża/Średnia/Mała/Tischnera) ──
  ('auditorium-maximum', 'Sala 1.1', 'Sala konferencyjna 1.1', 1, 30, 'Mała sala konferencyjna.'),
  ('auditorium-maximum', 'Sala 2.1', 'Sala konferencyjna 2.1', 2, 30, NULL),
  ('auditorium-maximum', 'Sala 2.2', 'Sala konferencyjna 2.2', 2, 30, NULL),
  ('auditorium-maximum', 'Sala Krawczyńskiego', 'Sala im. Krawczyńskiego', 1, 80, 'Sala reprezentacyjna sponsorów.'),
  ('auditorium-maximum', 'Foyer', 'Foyer Audi Maximum', 0, 200, 'Hol wejściowy — eventy, kawa, networking.'),

  -- ── Collegium Novum (już 3: Sala 30/52/56) ──
  ('collegium-novum', '31', 'Sala 31', 0, 30, 'Parter — sala seminaryjna.'),
  ('collegium-novum', '32', 'Sala 32', 0, 30, NULL),
  ('collegium-novum', '53', 'Sala 53', 1, 50, NULL),
  ('collegium-novum', '54', 'Sala 54', 1, 50, NULL),
  ('collegium-novum', '55', 'Sala 55', 1, 60, NULL),
  ('collegium-novum', '117', 'Sala 117', 1, 40, NULL),
  ('collegium-novum', '122', 'Sala 122', 1, 50, NULL),
  ('collegium-novum', '124', 'Sala 124', 1, 80, 'Audytorium na 1. piętrze.'),
  ('collegium-novum', 'Aula Wróblewskiego', 'Aula im. Z. Wróblewskiego', 0, 300, 'Reprezentacyjna aula CN.'),
  ('collegium-novum', 'Sala Senacka', 'Sala Senacka', 1, 60, 'Posiedzenia Senatu UJ — limited access.'),
  ('collegium-novum', 'Sala Bobrzyńskiego', 'Sala im. M. Bobrzyńskiego', 1, 50, NULL),
  ('collegium-novum', 'Sala Hołowczyca', 'Sala im. Hołowczyca', 1, 40, NULL),

  -- ── Collegium Maius (były 0 sal — same muzeum) ──
  ('collegium-maius', 'Aula Jagiellońska', 'Aula Jagiellońska', 1, 180, 'Historyczna aula wykładowa CM (XV w.).'),
  ('collegium-maius', 'Aula Kazimierzowska', 'Aula Kazimierza Wielkiego', 1, 100, NULL),
  ('collegium-maius', 'Stuba Communis', 'Stuba Communis', 0, 60, 'Refektarz profesorski.'),
  ('collegium-maius', 'Skarbiec', 'Skarbiec CM', 1, 25, 'Sala muzealna — zwiedzanie z przewodnikiem.'),

  -- ── WMI Łojasiewicza 6 (już 7: 0004, 0010, 0014, 0086, 1093-95) ──
  ('lojasiewicza-6', '0001', 'Sala 0001', 0, 60, NULL),
  ('lojasiewicza-6', '0002', 'Sala 0002', 0, 60, NULL),
  ('lojasiewicza-6', '0003', 'Sala 0003', 0, 50, NULL),
  ('lojasiewicza-6', '0085', 'Sala 0085', 0, 30, 'Pracownia komputerowa.'),
  ('lojasiewicza-6', '0087', 'Sala 0087', 0, 30, 'Pracownia komputerowa.'),
  ('lojasiewicza-6', '0088', 'Sala 0088', 0, 30, 'Pracownia komputerowa.'),
  ('lojasiewicza-6', '1001', 'Sala 1001', 1, 80, 'Aula wykładowa I p.'),
  ('lojasiewicza-6', '1002', 'Sala 1002', 1, 60, NULL),
  ('lojasiewicza-6', '1003', 'Sala 1003', 1, 60, NULL),
  ('lojasiewicza-6', '1010', 'Sala 1010', 1, 40, NULL),
  ('lojasiewicza-6', '1015', 'Sala 1015', 1, 30, 'Pracownia.'),
  ('lojasiewicza-6', '1023', 'Sala 1023', 1, 30, NULL),
  ('lojasiewicza-6', '2001', 'Sala 2001', 2, 80, NULL),
  ('lojasiewicza-6', '2002', 'Sala 2002', 2, 60, NULL),
  ('lojasiewicza-6', '2003', 'Sala 2003', 2, 40, NULL),
  ('lojasiewicza-6', '2010', 'Sala 2010', 2, 30, NULL),
  ('lojasiewicza-6', '2177', 'Sala 2177', 2, 30, NULL),
  ('lojasiewicza-6', '3001', 'Sala 3001', 3, 50, NULL),
  ('lojasiewicza-6', '3002', 'Sala 3002', 3, 40, NULL),
  ('lojasiewicza-6', '3010', 'Sala 3010', 3, 25, 'Sala seminaryjna.'),

  -- ── WFAIS Łojasiewicza 11 (już 4: A-101/102, B-01/02) ──
  ('lojasiewicza-11', 'A-103', 'Sala A-103', 1, 100, NULL),
  ('lojasiewicza-11', 'A-104', 'Sala A-104', 1, 80, NULL),
  ('lojasiewicza-11', 'A-105', 'Sala A-105', 1, 60, NULL),
  ('lojasiewicza-11', 'A-201', 'Sala A-201', 2, 100, NULL),
  ('lojasiewicza-11', 'A-202', 'Sala A-202', 2, 80, NULL),
  ('lojasiewicza-11', 'A-203', 'Sala A-203', 2, 60, NULL),
  ('lojasiewicza-11', 'A-0-01', 'Sala A-0-01', 0, 80, NULL),
  ('lojasiewicza-11', 'A-0-02', 'Sala A-0-02', 0, 60, NULL),
  ('lojasiewicza-11', 'A-0-03', 'Sala A-0-03', 0, 60, NULL),
  ('lojasiewicza-11', 'B-03', 'Sala B-03', 0, 60, NULL),
  ('lojasiewicza-11', 'B-04', 'Sala B-04', 0, 50, NULL),
  ('lojasiewicza-11', 'B-101', 'Sala B-101', 1, 50, NULL),
  ('lojasiewicza-11', 'B-102', 'Sala B-102', 1, 40, NULL),
  ('lojasiewicza-11', 'F-101', 'Sala F-101', 1, 30, 'Pracownia fizyczna.'),
  ('lojasiewicza-11', 'F-102', 'Sala F-102', 1, 30, 'Pracownia fizyczna.'),

  -- ── WZiKS Łojasiewicza 4 (już 5: 0.07/08, 1.07, 2.07, 3.05) ──
  ('lojasiewicza-4', '0.09', 'Sala 0.09', 0, 60, NULL),
  ('lojasiewicza-4', '0.10', 'Sala 0.10', 0, 50, NULL),
  ('lojasiewicza-4', '0.40', 'Sala 0.40', 0, 40, NULL),
  ('lojasiewicza-4', '1.06', 'Sala 1.06', 1, 80, NULL),
  ('lojasiewicza-4', '1.08', 'Sala 1.08', 1, 60, NULL),
  ('lojasiewicza-4', '1.10', 'Sala 1.10', 1, 50, NULL),
  ('lojasiewicza-4', '1.40', 'Sala 1.40', 1, 40, NULL),
  ('lojasiewicza-4', '2.06', 'Sala 2.06', 2, 60, NULL),
  ('lojasiewicza-4', '2.10', 'Sala 2.10', 2, 50, NULL),
  ('lojasiewicza-4', '2.40', 'Sala 2.40', 2, 40, NULL),
  ('lojasiewicza-4', '3.06', 'Sala 3.06', 3, 40, NULL),
  ('lojasiewicza-4', '3.10', 'Sala 3.10', 3, 30, NULL),
  ('lojasiewicza-4', '3.40', 'Sala 3.40', 3, 30, NULL),

  -- ── WCh Gronostajowa 2 (już 2: Aula B, 1.01) ──
  ('gronostajowa-2', 'Aula A', 'Aula A',     0, 220, 'Duża aula chemii — wykłady ogólne.'),
  ('gronostajowa-2', 'Aula C', 'Aula C',     1, 180, NULL),
  ('gronostajowa-2', '1.02', 'Sala 1.02',    1, 50, NULL),
  ('gronostajowa-2', '1.03', 'Sala 1.03',    1, 40, NULL),
  ('gronostajowa-2', '1.10', 'Sala 1.10',    1, 30, 'Pracownia chemiczna.'),
  ('gronostajowa-2', '2.01', 'Sala 2.01',    2, 50, NULL),
  ('gronostajowa-2', '2.02', 'Sala 2.02',    2, 40, NULL),
  ('gronostajowa-2', '2.10', 'Sala 2.10',    2, 30, 'Pracownia chemiczna.'),
  ('gronostajowa-2', '3.01', 'Sala 3.01',    3, 30, NULL),
  ('gronostajowa-2', '3.10', 'Sala 3.10',    3, 25, 'Pracownia chemiczna.'),

  -- ── WB Gronostajowa 9 (już 2: Aula 1, Aula 2) ──
  ('gronostajowa-9', 'Aula 3', 'Aula 3',                 0, 100, NULL),
  ('gronostajowa-9', 'A-1-01', 'Sala A-1-01',            1, 80, NULL),
  ('gronostajowa-9', 'A-1-02', 'Sala A-1-02',            1, 60, NULL),
  ('gronostajowa-9', 'A-1-03', 'Sala A-1-03',            1, 50, NULL),
  ('gronostajowa-9', 'A-2-01', 'Sala A-2-01',            2, 80, NULL),
  ('gronostajowa-9', 'A-2-02', 'Sala A-2-02',            2, 60, NULL),
  ('gronostajowa-9', 'P. Mikroskopowa', 'Pracownia mikroskopowa',  0, 25, NULL),
  ('gronostajowa-9', 'P. Ekologiczna',  'Pracownia ekologiczna',   1, 25, NULL),
  ('gronostajowa-9', 'P. Botaniki',     'Pracownia botaniki',      0, 30, NULL),

  -- ── WGG Gronostajowa 3a (już 1: A-0-04) ──
  ('gronostajowa-3a', 'A-0-05', 'Sala A-0-05', 0, 100, NULL),
  ('gronostajowa-3a', 'A-0-06', 'Sala A-0-06', 0, 80, NULL),
  ('gronostajowa-3a', 'A-1-04', 'Sala A-1-04', 1, 80, NULL),
  ('gronostajowa-3a', 'A-1-05', 'Sala A-1-05', 1, 60, NULL),
  ('gronostajowa-3a', 'A-2-04', 'Sala A-2-04', 2, 50, NULL),
  ('gronostajowa-3a', 'B-0-01', 'Sala B-0-01', 0, 60, 'Skrzydło Geologii.'),
  ('gronostajowa-3a', 'Aula Geologii', 'Aula Geologii', 0, 150, NULL),

  -- ── WFil al. Mickiewicza 9-11 (Paderevianum, już 2: 102, 301) ──
  ('mickiewicza-9-11', '101', 'Sala 101',   1, 80, NULL),
  ('mickiewicza-9-11', '103', 'Sala 103',   1, 60, NULL),
  ('mickiewicza-9-11', '104', 'Sala 104',   1, 50, NULL),
  ('mickiewicza-9-11', '201', 'Sala 201',   2, 80, NULL),
  ('mickiewicza-9-11', '202', 'Sala 202',   2, 60, NULL),
  ('mickiewicza-9-11', '203', 'Sala 203',   2, 50, NULL),
  ('mickiewicza-9-11', '302', 'Sala 302',   3, 60, NULL),
  ('mickiewicza-9-11', '303', 'Sala 303',   3, 50, NULL),
  ('mickiewicza-9-11', '401', 'Sala 401',   4, 50, NULL),
  ('mickiewicza-9-11', '402', 'Sala 402',   4, 40, NULL),
  ('mickiewicza-9-11', 'Aula Filologii', 'Aula Filologiczna', 0, 200, 'Reprezentacyjna aula WFil.'),

  -- ── WFz/Instytut Psychologii Ingardena 6 (już 2: 50, 128) ──
  ('ingardena-6', '12', 'Sala 12',    0, 40, NULL),
  ('ingardena-6', '13', 'Sala 13',    0, 40, NULL),
  ('ingardena-6', '25', 'Sala 25',    0, 50, NULL),
  ('ingardena-6', '78', 'Sala 78',    0, 60, NULL),
  ('ingardena-6', '100', 'Sala 100',  0, 80, 'Audytorium.'),
  ('ingardena-6', '201', 'Sala 201',  1, 80, NULL),
  ('ingardena-6', '220', 'Sala 220',  1, 50, NULL),
  ('ingardena-6', '250', 'Sala 250',  1, 40, NULL),
  ('ingardena-6', 'Sala Konferencyjna IP', 'Sala Konferencyjna Instytutu Psychologii', 1, 60, NULL),

  -- ── WH Gołębia 13 (już 1: 13) ──
  ('golebia-13', '11', 'Sala 11',     0, 30, NULL),
  ('golebia-13', '12', 'Sala 12',     0, 30, NULL),
  ('golebia-13', '17', 'Sala 17',     0, 40, NULL),
  ('golebia-13', '23', 'Sala 23',     0, 30, NULL),
  ('golebia-13', '25', 'Sala 25',     0, 25, NULL),
  ('golebia-13', '56', 'Sala 56',     1, 50, NULL),
  ('golebia-13', '102', 'Sala 102',   1, 40, NULL),
  ('golebia-13', '103', 'Sala 103',   1, 30, NULL),
  ('golebia-13', 'Sala Senacka WH', 'Sala Senacka Wydziału Historycznego', 1, 50, NULL),
  ('golebia-13', 'Audytorium Historii', 'Audytorium Historii', 0, 120, NULL),

  -- ── WPol Gołębia 16 (już 1: 42 Gołuchowskiego) ──
  ('golebia-16', '17', 'Sala 17',         0, 40, NULL),
  ('golebia-16', '23', 'Sala 23',         0, 30, NULL),
  ('golebia-16', '39', 'Sala 39',         0, 30, NULL),
  ('golebia-16', '47', 'Sala 47',         1, 50, NULL),
  ('golebia-16', '53', 'Sala 53',         1, 40, NULL),
  ('golebia-16', '58', 'Sala 58',         1, 60, NULL),
  ('golebia-16', 'Sala Reja', 'Sala im. Mikołaja Reja', 1, 50, NULL),
  ('golebia-16', 'Sala Pollaka', 'Sala im. R. Pollaka', 1, 40, NULL),
  ('golebia-16', 'Sala Brücknera', 'Sala im. A. Brücknera', 0, 60, NULL),
  ('golebia-16', 'Sala Studencka', 'Sala Studencka', 0, 30, 'Open space dla studentów Polonistyki.'),

  -- ── WPiA Bracka 12 (już 2: Refektarz, 52) ──
  ('bracka-12', '11', 'Sala 11',          0, 40, NULL),
  ('bracka-12', '23', 'Sala 23',          0, 30, NULL),
  ('bracka-12', '41', 'Sala 41',          0, 50, NULL),
  ('bracka-12', '56', 'Sala 56',          1, 60, NULL),
  ('bracka-12', '78', 'Sala 78',          1, 50, NULL),
  ('bracka-12', '101', 'Sala 101',        1, 80, NULL),
  ('bracka-12', '102', 'Sala 102',        1, 60, NULL),
  ('bracka-12', '110', 'Sala 110',        1, 50, NULL),
  ('bracka-12', '200', 'Sala 200',        2, 60, NULL),
  ('bracka-12', '201', 'Sala 201',        2, 50, NULL),
  ('bracka-12', 'Sala Rady Wydziału', 'Sala Rady Wydziału WPiA', 1, 60, NULL),

  -- ── WSMiP Reymonta 4 (już 2: 17, 54) ──
  ('reymonta-4', '18', 'Sala 18',         0, 60, NULL),
  ('reymonta-4', '19', 'Sala 19',         0, 50, NULL),
  ('reymonta-4', '23', 'Sala 23',         0, 40, NULL),
  ('reymonta-4', '39', 'Sala 39',         0, 30, NULL),
  ('reymonta-4', '55', 'Sala 55',         1, 60, NULL),
  ('reymonta-4', '56', 'Sala 56',         1, 50, NULL),
  ('reymonta-4', '57', 'Sala 57',         1, 40, NULL),
  ('reymonta-4', '78', 'Sala 78',         1, 30, NULL),
  ('reymonta-4', '88', 'Sala 88',         1, 50, NULL),
  ('reymonta-4', 'Aula WSMiP', 'Aula WSMiP', 0, 150, 'Reprezentacyjna aula Wydziału.'),

  -- ── BJ Mickiewicza 22 (już 2: CzNS, CzG) ──
  ('mickiewicza-22-bj', 'CzNH', 'Czytelnia Naukowa Humanistyczna', 1, 100, NULL),
  ('mickiewicza-22-bj', 'CzNT', 'Czytelnia Naukowa Techniczna',    1, 80, NULL),
  ('mickiewicza-22-bj', 'CzCz', 'Czytelnia Czasopism',             1, 60, NULL),
  ('mickiewicza-22-bj', 'CzMed', 'Czytelnia Mediatek',             0, 40, NULL),
  ('mickiewicza-22-bj', 'Sala Konferencyjna BJ', 'Sala Konferencyjna BJ', 0, 100, NULL),
  ('mickiewicza-22-bj', 'Sala Audio', 'Sala Audiowizualna',        0, 60, NULL),

  -- ── SWFiS Piastowska 26 (już 1: Hala) ──
  ('piastowska-26', 'Sala Fitness', 'Sala Fitness',       1, 30, NULL),
  ('piastowska-26', 'Siłownia', 'Siłownia',               0, 40, NULL),
  ('piastowska-26', 'Sala Tenisowa', 'Sala Tenisowa',     0, 20, NULL),
  ('piastowska-26', 'Sala Spotkań', 'Sala Spotkań SWFiS', 1, 50, NULL),
  ('piastowska-26', 'Sala Aerobiku', 'Sala Aerobiku',     1, 25, NULL),

  -- ── CM UJ Św. Anny 12 (były 0) ──
  ('sw-anny-12', 'Aula CM', 'Aula Collegium Medicum',         0, 200, 'Główna aula CM.'),
  ('sw-anny-12', 'Sala 1', 'Sala dydaktyczna 1',              0, 60, NULL),
  ('sw-anny-12', 'Sala 2', 'Sala dydaktyczna 2',              0, 50, NULL),
  ('sw-anny-12', 'Sala 3', 'Sala dydaktyczna 3',              1, 40, NULL),
  ('sw-anny-12', 'Sala 4', 'Sala dydaktyczna 4',              1, 40, NULL),
  ('sw-anny-12', 'Sala Reprezentacyjna CM', 'Sala Reprezentacyjna CM', 1, 80, NULL),
  ('sw-anny-12', 'Sala Anatomiczna', 'Sala Anatomiczna',      0, 30, 'Pracownia anatomii.')

ON CONFLICT (building_id, code) DO NOTHING;

COMMIT;
