-- UJ Sale Finder — directory of UJ buildings and rooms.
--
-- Funkcja "Sale finder": user wpisuje kod sali (np. "0010" albo "Aula 100")
-- albo nazwę budynku, dostaje lokalizację na mapie (lat/lng), zdjęcie wejścia
-- (jeśli mamy), adres i deep-link do Google Maps z nawigacją pieszą. Dane są
-- curated (read-only dla wszystkich; insert/update tylko service role + admin
-- via Studio).
--
-- Schema rationale:
--   - `uj_buildings`: jeden wiersz per budynek UJ (ok. 20-30 docelowo). Slug
--     PK żeby permalinki były czytelne ('/sale/lojasiewicza-6').
--   - `uj_rooms`: sale w budynkach. Kod sali (`0010`, `Aula 100`) jest unique
--     per budynek, ale nie globalnie (dwie różne sale "0010" w dwóch
--     budynkach to standardowa praktyka).
--   - `search_aliases`: tablica alternatywnych nazw ('CN', 'Maius', '600-lecia')
--     żeby simple ILIKE w `SaleFinderService` dawał trafienia bez Meilisearch.
--
-- Photo URLs są nullable — backfill przez admina (Supabase Storage) później.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Tabele
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.uj_buildings (
  id TEXT PRIMARY KEY, -- slug, np. 'collegium-novum'
  name TEXT NOT NULL,
  short_name TEXT,
  address TEXT NOT NULL,
  lat NUMERIC(9, 6) NOT NULL,
  lng NUMERIC(9, 6) NOT NULL,
  photo_url TEXT,
  description TEXT,
  -- Luźny FK po stringu do `groups.slug` (kanoniczny slug wydziału).
  -- NULL dla budynków nie-wydziałowych (Auditorium Maximum, BJ, akademiki).
  faculty_slug TEXT,
  search_aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- '600-lecia' / 'srodmiescie' / 'medyczny' / NULL — do filtrowania per kampus.
  campus TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uj_buildings_faculty_idx
  ON public.uj_buildings (faculty_slug)
  WHERE faculty_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS uj_buildings_campus_idx
  ON public.uj_buildings (campus)
  WHERE campus IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.uj_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id TEXT NOT NULL REFERENCES public.uj_buildings (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  display_name TEXT,
  floor INT,
  capacity INT,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (building_id, code)
);

CREATE INDEX IF NOT EXISTS uj_rooms_building_idx ON public.uj_rooms (building_id);
CREATE INDEX IF NOT EXISTS uj_rooms_code_idx ON public.uj_rooms (lower(code));

-- ──────────────────────────────────────────────────────────────────────────
-- 2. RLS — public read, write tylko service_role / Studio (brak policy = deny)
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.uj_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uj_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uj_buildings_select_public"
  ON public.uj_buildings FOR SELECT
  USING (true);

CREATE POLICY "uj_rooms_select_public"
  ON public.uj_rooms FOR SELECT
  USING (true);

-- Brak policies INSERT/UPDATE/DELETE — efektywnie tylko service_role pisze
-- (anon i authenticated dostają deny). Admini robią update przez Supabase
-- Studio (service role) albo skryptem migracyjnym.

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Seed budynków UJ (kluczowe lokalizacje)
-- ──────────────────────────────────────────────────────────────────────────

INSERT INTO public.uj_buildings
  (id, name, short_name, address, lat, lng, faculty_slug, campus, search_aliases, description)
VALUES
  ('collegium-novum',
   'Collegium Novum',
   'CN',
   'ul. Gołębia 24, 31-007 Kraków',
   50.061193, 19.933194,
   NULL, 'srodmiescie',
   ARRAY['CN', 'Rektorat', 'Goleby 24'],
   'Główny budynek rektoratu UJ. Sale wykładowe + reprezentacyjna Aula.'),
  ('collegium-maius',
   'Collegium Maius',
   'CM',
   'ul. Jagiellońska 15, 31-010 Kraków',
   50.061735, 19.933408,
   NULL, 'srodmiescie',
   ARRAY['Maius', 'Muzeum UJ', 'Jagiellonska 15'],
   'Najstarszy budynek UJ (XV w.). Muzeum + sale dydaktyczne.'),
  ('auditorium-maximum',
   'Auditorium Maximum',
   'AM',
   'ul. Krupnicza 33, 31-123 Kraków',
   50.062645, 19.930540,
   NULL, 'srodmiescie',
   ARRAY['AM', 'Krupnicza 33', 'Audi Max'],
   'Największa aula UJ. Wykłady ogólnouczelniane + duże egzaminy.'),
  ('lojasiewicza-6',
   'Wydział Matematyki i Informatyki',
   'WMI',
   'ul. Łojasiewicza 6, 30-348 Kraków',
   50.029400, 19.901900,
   'wmii', '600-lecia',
   ARRAY['WMI', 'Lojasiewicza 6', 'Matma', 'Informatyka', '600-lecia'],
   'Wydział Matematyki i Informatyki. Kampus 600-lecia Odnowienia UJ.'),
  ('lojasiewicza-11',
   'Wydział Fizyki, Astronomii i Informatyki Stosowanej',
   'WFAIS',
   'ul. Łojasiewicza 11, 30-348 Kraków',
   50.029900, 19.902800,
   'wfais', '600-lecia',
   ARRAY['WFAIS', 'Lojasiewicza 11', 'Fizyka', 'Astronomia'],
   'Wydział Fizyki, Astronomii i Informatyki Stosowanej. Kampus 600-lecia.'),
  ('gronostajowa-9',
   'Wydział Biologii',
   'WB',
   'ul. Gronostajowa 9, 30-387 Kraków',
   50.030100, 19.903700,
   'wbiol', '600-lecia',
   ARRAY['Biologia'],
   'Wydział Biologii UJ. Kampus 600-lecia.'),
  ('gronostajowa-2',
   'Wydział Chemii',
   'WCh',
   'ul. Gronostajowa 2, 30-387 Kraków',
   50.029000, 19.904300,
   'wch', '600-lecia',
   ARRAY['Chemia'],
   'Wydział Chemii UJ. Kampus 600-lecia.'),
  ('gronostajowa-3a',
   'Wydział Geografii i Geologii',
   'WGG',
   'ul. Gronostajowa 3a, 30-387 Kraków',
   50.029800, 19.905000,
   'wgig', '600-lecia',
   ARRAY['WGiG', 'Geografia', 'Geologia'],
   'Wydział Geografii i Geologii. Kampus 600-lecia.'),
  ('lojasiewicza-4',
   'Wydział Zarządzania i Komunikacji Społecznej',
   'WZiKS',
   'ul. Łojasiewicza 4, 30-348 Kraków',
   50.029700, 19.901300,
   'wziks', '600-lecia',
   ARRAY['WZiKS', 'Lojasiewicza 4', 'Zarzadzanie', 'KomSpol'],
   'Wydział Zarządzania i Komunikacji Społecznej. Kampus 600-lecia.'),
  ('mickiewicza-9-11',
   'Wydział Filologiczny',
   'WFil',
   'al. Mickiewicza 9-11, 31-120 Kraków',
   50.065300, 19.922400,
   'wf', 'srodmiescie',
   ARRAY['WFil', 'Filologia', 'Anglistyka', 'Romanistyka'],
   'Wydział Filologiczny UJ.'),
  ('ingardena-6',
   'Wydział Filozoficzny',
   'WFz',
   'ul. Ingardena 6, 30-060 Kraków',
   50.062600, 19.922400,
   'wfilo', 'srodmiescie',
   ARRAY['WFz', 'Filozofia', 'Psychologia', 'Instytut Psychologii'],
   'Wydział Filozoficzny / Instytut Psychologii.'),
  ('golebia-13',
   'Wydział Historyczny',
   'WH',
   'ul. Gołębia 13, 31-007 Kraków',
   50.061200, 19.934100,
   'wh', 'srodmiescie',
   ARRAY['WH', 'Historia'],
   'Wydział Historyczny UJ.'),
  ('golebia-16',
   'Wydział Polonistyki',
   'WPol',
   'ul. Gołębia 16, 31-007 Kraków',
   50.061300, 19.934300,
   'wpol', 'srodmiescie',
   ARRAY['Polonistyka'],
   'Wydział Polonistyki UJ.'),
  ('bracka-12',
   'Wydział Prawa i Administracji',
   'WPiA',
   'ul. Bracka 12, 31-005 Kraków',
   50.060600, 19.937900,
   'wpia', 'srodmiescie',
   ARRAY['WPiA', 'Prawo', 'Bracka'],
   'Wydział Prawa i Administracji.'),
  ('reymonta-4',
   'Wydział Studiów Międzynarodowych i Politycznych',
   'WSMiP',
   'ul. Reymonta 4, 30-059 Kraków',
   50.064100, 19.916300,
   'wsmip', 'srodmiescie',
   ARRAY['WSMiP', 'Stosunki Miedzynarodowe', 'Politologia'],
   'Wydział Studiów Międzynarodowych i Politycznych.'),
  ('mickiewicza-22-bj',
   'Biblioteka Jagiellońska',
   'BJ',
   'al. Mickiewicza 22, 30-059 Kraków',
   50.064200, 19.920100,
   NULL, 'srodmiescie',
   ARRAY['BJ', 'Biblioteka', 'Jagiellonka'],
   'Główna biblioteka UJ. Czytelnie + wypożyczalnia.'),
  ('piastowska-26',
   'Studium Wychowania Fizycznego i Sportu',
   'SWFiS',
   'ul. Piastowska 26, 30-070 Kraków',
   50.063100, 19.907900,
   NULL, 'srodmiescie',
   ARRAY['SWFiS', 'WF', 'Sport', 'Hala'],
   'Hala sportowa UJ + zajęcia WF.'),
  ('sw-anny-12',
   'Collegium Medicum — Św. Anny',
   'CM UJ',
   'ul. Św. Anny 12, 31-008 Kraków',
   50.061600, 19.936700,
   NULL, 'medyczny',
   ARRAY['CM UJ', 'Medycyna', 'Sw Anny'],
   'Zabytkowy budynek Collegium Medicum UJ.')
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Seed sal — najczęściej używane (audytoria, aule, kluczowe duże)
-- ──────────────────────────────────────────────────────────────────────────

INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity, notes)
VALUES
  -- Auditorium Maximum
  ('auditorium-maximum', 'Aula Duża',     'Aula Duża',                       0, 1100, 'Wejście główne od Krupniczej 33.'),
  ('auditorium-maximum', 'Aula Średnia',  'Aula Średnia',                    1,  350, NULL),
  ('auditorium-maximum', 'Aula Mała',     'Aula Mała',                       1,  180, NULL),
  ('auditorium-maximum', 'Aula Tischnera','Aula im. ks. Józefa Tischnera',   0,  600, NULL),

  -- Collegium Novum
  ('collegium-novum', '52', 'Sala 52', 1, 80, 'Audytorium na 1. piętrze.'),
  ('collegium-novum', '56', 'Sala 56', 1, 60, NULL),
  ('collegium-novum', '30', 'Sala 30', 0, 40, 'Parter.'),

  -- WMI Łojasiewicza 6
  ('lojasiewicza-6', '0004', 'Sala 0004', 0, 220, 'Główna aula wykładowa WMI.'),
  ('lojasiewicza-6', '0010', 'Sala 0010', 0,  60, NULL),
  ('lojasiewicza-6', '0014', 'Sala 0014', 0,  60, NULL),
  ('lojasiewicza-6', '0086', 'Sala 0086', 0,  30, 'Pracownia komputerowa.'),
  ('lojasiewicza-6', '1093', 'Sala 1093', 1,  40, NULL),
  ('lojasiewicza-6', '1094', 'Sala 1094', 1,  40, NULL),
  ('lojasiewicza-6', '1095', 'Sala 1095', 1,  40, NULL),

  -- WFAIS Łojasiewicza 11
  ('lojasiewicza-11', 'A-101', 'Sala A-101', 1, 200, 'Główna aula fizyki.'),
  ('lojasiewicza-11', 'A-102', 'Sala A-102', 1, 120, NULL),
  ('lojasiewicza-11', 'B-01',  'Sala B-01',  0,  60, NULL),
  ('lojasiewicza-11', 'B-02',  'Sala B-02',  0,  60, NULL),

  -- WZiKS Łojasiewicza 4
  ('lojasiewicza-4', '0.07', 'Aula 0.07', 0, 250, NULL),
  ('lojasiewicza-4', '0.08', 'Sala 0.08', 0,  60, NULL),
  ('lojasiewicza-4', '1.07', 'Sala 1.07', 1,  80, NULL),
  ('lojasiewicza-4', '2.07', 'Sala 2.07', 2,  60, NULL),
  ('lojasiewicza-4', '3.05', 'Sala 3.05', 3,  40, NULL),

  -- WCh Gronostajowa 2
  ('gronostajowa-2', 'Aula B', 'Aula B',     0, 250, 'Główne audytorium Wydziału Chemii.'),
  ('gronostajowa-2', '1.01',   'Sala 1.01',  1,  50, NULL),

  -- WB Gronostajowa 9
  ('gronostajowa-9', 'Aula 1', 'Aula 1', 0, 220, NULL),
  ('gronostajowa-9', 'Aula 2', 'Aula 2', 0, 120, NULL),

  -- WGG Gronostajowa 3a
  ('gronostajowa-3a', 'A-0-04', 'Sala A-0-04', 0, 120, NULL),

  -- WPiA Bracka 12
  ('bracka-12', 'Refektarz', 'Refektarz', 0, 250, 'Aula reprezentacyjna.'),
  ('bracka-12', '52',        'Sala 52',   1,  80, NULL),

  -- WPol Gołębia 16
  ('golebia-16', '42', 'Sala im. Gołuchowskiego', 1, 60, NULL),

  -- WSMiP Reymonta 4
  ('reymonta-4', '17', 'Sala 17', 0, 80, NULL),
  ('reymonta-4', '54', 'Sala 54', 1, 40, NULL),

  -- BJ
  ('mickiewicza-22-bj', 'CzNS', 'Czytelnia Naukowa Społeczna', 1,  80, 'Wejście od strony Mickiewicza 22.'),
  ('mickiewicza-22-bj', 'CzG',  'Czytelnia Główna',            1, 200, NULL),

  -- SWFiS
  ('piastowska-26', 'Hala', 'Hala Główna', 0, 600, 'Hala sportowa SWFiS.'),

  -- Filologia
  ('mickiewicza-9-11', '301', 'Sala 301', 3, 100, 'Audytorium Anglistyki.'),
  ('mickiewicza-9-11', '102', 'Sala 102', 1,  80, NULL),

  -- Filozoficzny / Psychologia
  ('ingardena-6', '128', 'Sala 128', 1, 80, NULL),
  ('ingardena-6', '50',  'Sala 50',  0, 60, NULL),

  -- WH
  ('golebia-13', '13', 'Audytorium 13', 0, 80, NULL)
ON CONFLICT (building_id, code) DO NOTHING;
