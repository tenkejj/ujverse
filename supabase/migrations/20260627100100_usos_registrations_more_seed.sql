-- =====================================================================
-- UJverse — USOS Registrations: rozszerzony seed (40 dodatkowych)
-- =====================================================================
-- Dopełnienie startowego seeda z migracji 20260627100000. Pokrywa
-- praktycznie wszystkie główne kierunki UJ + Collegium Medicum +
-- rejestracje ogólnouczelniane (Erasmus, praktyki).
--
-- Idempotencja: INSERT ... SELECT FROM VALUES ... WHERE NOT EXISTS
-- po `title` — bezpieczne do re-runu (np. po manualnym dodaniu wpisu).
-- created_by = NULL (seedy systemowe).
-- =====================================================================

insert into public.usos_registrations
  (title, description, study_program, year, audience_label, opens_at, closes_at, registration_url, info_url, kind)
select
  v.title, v.description, v.study_program, v.year, v.audience_label,
  v.opens_at::timestamptz, v.closes_at::timestamptz,
  v.registration_url, v.info_url, v.kind
from (values

-- ──────────────────────────────────────────────────────────────────────
-- FAIS — Fizyka, Astronomia, Informatyka Stosowana
-- ──────────────────────────────────────────────────────────────────────
('Informatyka Stosowana II rok — przedmioty obieralne',
 'Wybór 3 z 9 obieralnych: Programowanie GPU, Systemy Czasu Rzeczywistego, Web Apps, Kompilatory, Bazy NoSQL, Mobile Dev, Visualization, Embedded Linux, Robotyka.',
 'Informatyka Stosowana', 2, 'Informatyka Stosowana, II rok I stopnia',
 '2026-09-22 11:00:00+02', '2026-09-25 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.fais.uj.edu.pl', 'obieralne'),

('Fizyka III rok — specjalizacja',
 'Wybór bloku specjalizacyjnego: Fizyka Teoretyczna, Fizyka Doświadczalna, Fizyka Medyczna, Biofizyka, Nanofizyka.',
 'Fizyka', 3, 'Fizyka, III rok I stopnia',
 '2026-09-21 09:00:00+02', '2026-09-24 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.fais.uj.edu.pl/fizyka', 'specjalizacja'),

('Astronomia II rok — pracownia obserwacyjna',
 'Zapis na pracownię w Obserwatorium UJ w Forcie Skała. Limity grup 4-6 osób. Wybór nocy obserwacyjnych.',
 'Astronomia', 2, 'Astronomia, II rok I stopnia',
 '2026-09-20 16:00:00+02', '2026-09-23 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://oa.uj.edu.pl', 'inne'),

-- ──────────────────────────────────────────────────────────────────────
-- Wydział Matematyki i Informatyki
-- ──────────────────────────────────────────────────────────────────────
('Matematyka II rok — przedmioty obieralne',
 'Wybór 2 z 6: Topologia, Analiza Funkcjonalna, Teoria Grup, Geometria Klasyczna, Programowanie w Pythonie dla Matematyków, Wstęp do Statystyki.',
 'Matematyka', 2, 'Matematyka, II rok I stopnia',
 '2026-09-22 12:00:00+02', '2026-09-25 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.matinf.uj.edu.pl', 'obieralne'),

('Matematyka Komputerowa — seminarium magisterskie',
 'Zapis do promotora pracy magisterskiej. Pełna lista wraz z opisami w sylabusie.',
 'Matematyka Komputerowa', 4, 'Matematyka Komputerowa, IV rok',
 '2026-09-19 14:00:00+02', '2026-09-22 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 null, 'seminarium'),

-- ──────────────────────────────────────────────────────────────────────
-- Wydział Chemii
-- ──────────────────────────────────────────────────────────────────────
('Chemia III rok — laboratoria specjalizacyjne',
 'Wybór 3 z 7 laboratoriów: Chemia Organiczna Zaawansowana, Synteza Asymetryczna, Krystalografia, Chemia Polimerów, Elektrochemia, Spektroskopia NMR, Katalityka.',
 'Chemia', 3, 'Chemia, III rok I stopnia',
 '2026-09-23 10:00:00+02', '2026-09-26 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.chemia.uj.edu.pl', 'specjalizacja'),

('Biotechnologia II rok — przedmioty obieralne',
 'Wybór 2 z 8: Inżynieria Genetyczna, Bioinformatyka, Biotechnologia Roślin, Mikrobiologia Przemysłowa, Immunologia Stosowana, Biofarmaceutyki, GMO, Biostatystyka.',
 'Biotechnologia', 2, 'Biotechnologia, II rok I stopnia',
 '2026-09-22 13:00:00+02', '2026-09-25 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.wbbib.uj.edu.pl', 'obieralne'),

-- ──────────────────────────────────────────────────────────────────────
-- Wydział Biologii
-- ──────────────────────────────────────────────────────────────────────
('Biologia II rok — pracownie specjalistyczne',
 'Zapis na 2 z 10 pracowni: Botanika, Zoologia Bezkręgowców, Zoologia Kręgowców, Ekologia, Mikrobiologia, Genetyka, Fizjologia Roślin, Fizjologia Zwierząt, Hydrobiologia, Parazytologia.',
 'Biologia', 2, 'Biologia, II rok I stopnia',
 '2026-09-23 14:00:00+02', '2026-09-26 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.biologia.uj.edu.pl', 'obieralne'),

-- ──────────────────────────────────────────────────────────────────────
-- Wydział Geografii i Geologii
-- ──────────────────────────────────────────────────────────────────────
('Geografia III rok — specjalizacja',
 'Wybór ścieżki: Geografia Fizyczna, Geografia Społeczno-Ekonomiczna, Geomatyka, Gospodarka Przestrzenna, Turystyka.',
 'Geografia', 3, 'Geografia, III rok I stopnia',
 '2026-09-21 11:00:00+02', '2026-09-24 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://geo.uj.edu.pl', 'specjalizacja'),

('Geologia — letnia praktyka terenowa',
 'Zapis na 2-tygodniowe praktyki terenowe (Tatry / Pieniny / Karpaty). Limity grup 12 osób. WAŻNE: konieczne badania lekarskie i ekwipunek.',
 'Geologia', 2, 'Geologia, II rok I stopnia',
 '2026-04-20 09:00:00+02', '2026-04-30 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.ing.uj.edu.pl', 'inne'),

-- ──────────────────────────────────────────────────────────────────────
-- Wydział Filologiczny
-- ──────────────────────────────────────────────────────────────────────
('Filologia Romańska — seminarium magisterskie',
 'Zapis do promotora. Lista promotorów + obszary badawcze w opisie.',
 'Filologia Romańska', 4, 'Filologia Romańska, IV rok jednolitych magisterskich',
 '2026-09-19 11:00:00+02', '2026-09-22 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 null, 'seminarium'),

('Filologia Germańska I rok — przedmioty obieralne',
 'Wybór 2 z 6: Niemiecka Literatura Współczesna, Lingwistyka Stosowana, Historia Niemiec, Kultura DACH, Tłumaczenia Specjalistyczne, Wstęp do Translatoryki.',
 'Filologia Germańska', 1, 'Filologia Germańska, I rok I stopnia',
 '2026-09-24 10:00:00+02', '2026-09-27 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 null, 'obieralne'),

('Hispanistyka II rok — drugi język romański',
 'Zapis na drugi język: francuski / włoski / portugalski / kataloński. Wszystkie od poziomu A1.',
 'Hispanistyka', 2, 'Hispanistyka, II rok I stopnia',
 '2026-09-24 12:00:00+02', '2026-09-27 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 null, 'lektoraty'),

('Filologia Klasyczna — wybór ścieżki',
 'Wybór ścieżki tematycznej: Filologia Grecka, Filologia Łacińska, Bizantynistyka, Średniowiecze Łacińskie.',
 'Filologia Klasyczna', 2, 'Filologia Klasyczna, II rok I stopnia',
 '2026-09-22 14:00:00+02', '2026-09-25 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 null, 'specjalizacja'),

('Slawistyka — wybór języka',
 'Zapis na podstawowy język slawistyczny (czeski, słowacki, ukraiński, bułgarski, chorwacki, serbski, słoweński, macedoński). Grupy 8-15 osób.',
 'Slawistyka', 1, 'Slawistyka, I rok I stopnia',
 '2026-09-23 09:00:00+02', '2026-09-26 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.filg.uj.edu.pl', 'lektoraty'),

-- ──────────────────────────────────────────────────────────────────────
-- Wydział Polonistyki
-- ──────────────────────────────────────────────────────────────────────
('Polonistyka II rok — przedmioty obieralne',
 'Wybór 3 z 14 obieralnych: Literatura Najnowsza, Edytorstwo, Krytyka Literacka, Komparatystyka, Genderowe Czytania, Filmoznawstwo, Komiks, Teatr Współczesny i inne.',
 'Polonistyka', 2, 'Polonistyka, II rok I stopnia',
 '2026-09-22 09:30:00+02', '2026-09-25 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://polonistyka.uj.edu.pl', 'obieralne'),

('Polonistyka — Komparatystyka Literacka — seminarium',
 'Zapis do promotora seminarium specjalizacyjnego komparatystyki.',
 'Polonistyka', 3, 'Polonistyka, III rok I stopnia, sekcja komparatystyczna',
 '2026-09-19 13:00:00+02', '2026-09-22 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 null, 'seminarium'),

-- ──────────────────────────────────────────────────────────────────────
-- Wydział Historyczny
-- ──────────────────────────────────────────────────────────────────────
('Historia III rok — specjalność',
 'Wybór specjalności: Historia Polski, Historia Powszechna, Historia Wojskowości, Historia Sztuki, Historia Kościoła.',
 'Historia', 3, 'Historia, III rok I stopnia',
 '2026-09-21 12:00:00+02', '2026-09-24 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.historia.uj.edu.pl', 'specjalizacja'),

('Historia Sztuki II rok — wybór obszaru',
 'Wybór obszaru kursu specjalizacyjnego: Sztuka Starożytna, Średniowieczna, Nowożytna, XIX wiek, XX wiek, Współczesna, Wschodu.',
 'Historia Sztuki', 2, 'Historia Sztuki, II rok I stopnia',
 '2026-09-22 11:30:00+02', '2026-09-25 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 null, 'obieralne'),

('Archeologia — letnie wykopaliska',
 'Zapis na 3-tygodniowe wykopaliska terenowe (różne stanowiska — szczegóły w opisie). Wymagane dobre warunki fizyczne, własny śpiwór.',
 'Archeologia', 2, 'Archeologia, II rok',
 '2026-04-15 10:00:00+02', '2026-04-30 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.archeo.uj.edu.pl', 'inne'),

-- ──────────────────────────────────────────────────────────────────────
-- Wydział Filozoficzny — Filozofia, Religioznawstwo, Psychologia, Socjo
-- ──────────────────────────────────────────────────────────────────────
('Filozofia II rok — przedmioty obieralne',
 'Wybór 3 z 10: Metaetyka, Filozofia Umysłu, Filozofia Polityki, Fenomenologia, Filozofia Nauki, Epistemologia Społeczna, Bioetyka, Filozofia Wschodu, Logika Modalna, Filozofia Religii.',
 'Filozofia', 2, 'Filozofia, II rok I stopnia',
 '2026-09-22 13:30:00+02', '2026-09-25 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://filozofia.uj.edu.pl', 'obieralne'),

('Religioznawstwo III rok — seminarium magisterskie',
 'Zapis do promotora. Wybór z 12 promotorów (Religie Indii, Islamu, Buddyzmu, Chrześcijaństwa Wczesnego, Nowe Ruchy Religijne i inne).',
 'Religioznawstwo', 3, 'Religioznawstwo, III rok I stopnia',
 '2026-09-19 15:00:00+02', '2026-09-22 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 null, 'seminarium'),

('Psychologia I rok — przedmioty obieralne',
 'Wybór 2 z 5: Psychologia Społeczna Stosowana, Wprowadzenie do Psychoanalizy, Filozofia Psychologii, Statystyka w R, Psychologia Reklamy.',
 'Psychologia', 1, 'Psychologia, I rok jednolitych magisterskich',
 '2026-09-24 16:00:00+02', '2026-09-27 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 null, 'obieralne'),

('Psychologia III rok — specjalność',
 'Wybór specjalności: Kliniczna, Społeczna, Pracy i Organizacji, Edukacyjna, Sądowa, Sportu, Międzykulturowa.',
 'Psychologia', 3, 'Psychologia, III rok jednolitych magisterskich',
 '2026-09-20 16:00:00+02', '2026-09-23 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 null, 'specjalizacja'),

('Socjologia II rok — obieralne',
 'Wybór 3 z 9: Socjologia Miasta, Socjologia Internetu, Antropologia Społeczna, Socjologia Religii, Polityki Społeczne, Gender Studies, Migracje, Mass Media, Etnografia.',
 'Socjologia', 2, 'Socjologia, II rok I stopnia',
 '2026-09-22 15:00:00+02', '2026-09-25 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.socjologia.uj.edu.pl', 'obieralne'),

('Pedagogika II rok — specjalność',
 'Wybór ścieżki: Pedagogika Wczesnoszkolna, Resocjalizacja, Pedagogika Specjalna, Pedagogika Społeczna, Edukacja Międzykulturowa.',
 'Pedagogika', 2, 'Pedagogika, II rok I stopnia',
 '2026-09-22 16:00:00+02', '2026-09-25 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://pedagogika.uj.edu.pl', 'specjalizacja'),

-- ──────────────────────────────────────────────────────────────────────
-- Wydział Studiów Międzynarodowych i Politycznych
-- ──────────────────────────────────────────────────────────────────────
('Politologia II rok — obieralne',
 'Wybór 3 z 8: Systemy Polityczne UE, Polityka USA, Polityka Bezpieczeństwa, Bałkany, Bliski Wschód, Marketing Polityczny, Polska Polityka Wewnętrzna, Komunikowanie Polityczne.',
 'Politologia', 2, 'Politologia, II rok I stopnia',
 '2026-09-23 11:00:00+02', '2026-09-26 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://wsmip.uj.edu.pl', 'obieralne'),

('Studia Międzynarodowe — wybór regionu',
 'Wybór regionu specjalizacji: Europa Środkowo-Wschodnia, Azja, Afryka, Ameryki, Bliski Wschód. Każdy region = 4 przedmioty kierunkowe.',
 'Studia Międzynarodowe', 2, 'Studia Międzynarodowe, II rok I stopnia',
 '2026-09-22 12:30:00+02', '2026-09-25 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 null, 'specjalizacja'),

('Europeistyka — Erasmus+ outbound (sem. zimowy 2027)',
 'Aplikacje na wyjazdy Erasmus+ na semestr zimowy 2027. Lista uczelni partnerskich + wymagane języki w opisie. Konieczny średnia ≥ 4.0.',
 'Europeistyka', 2, 'Europeistyka, II-III rok I stopnia',
 '2026-11-15 09:00:00+01', '2026-12-15 23:59:00+01',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://erasmus.uj.edu.pl', 'inne'),

-- ──────────────────────────────────────────────────────────────────────
-- Wydział Zarządzania i Komunikacji Społecznej
-- ──────────────────────────────────────────────────────────────────────
('Zarządzanie II rok — specjalizacja',
 'Wybór ścieżki: Zarządzanie Strategiczne, Marketing, Finanse, Human Resources, Zarządzanie Projektami, E-biznes.',
 'Zarządzanie', 2, 'Zarządzanie, II rok I stopnia',
 '2026-09-22 14:30:00+02', '2026-09-25 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://wzks.uj.edu.pl', 'specjalizacja'),

('Ekonomia III rok — obieralne',
 'Wybór 3 z 7 obieralnych: Ekonometria, Finanse Behawioralne, Ekonomia Międzynarodowa, Polityka Monetarna, Mikroekonomia Zaawansowana, Big Data w Ekonomii, Game Theory.',
 'Ekonomia', 3, 'Ekonomia, III rok I stopnia',
 '2026-09-22 10:00:00+02', '2026-09-25 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 null, 'obieralne'),

('Dziennikarstwo — wybór warsztatu',
 'Zapis na warsztat: Reportaż Prasowy, Reportaż Radiowy, Telewizja, Dziennikarstwo Internetowe, Foto-reportaż, Podcasting.',
 'Dziennikarstwo', 1, 'Dziennikarstwo i Komunikacja Społeczna, I rok',
 '2026-09-24 13:00:00+02', '2026-09-27 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://wzks.uj.edu.pl/instytut-dziennikarstwa', 'specjalizacja'),

-- ──────────────────────────────────────────────────────────────────────
-- Collegium Medicum
-- ──────────────────────────────────────────────────────────────────────
('Lekarski III rok — przedmioty obieralne CM',
 'Wybór 2 z 12 modułów klinicznych: Medycyna Sportowa, Medycyna Pracy, Endokrynologia, Reumatologia, Gastroenterologia, Onkologia, Dermatologia, Okulistyka, Laryngologia, Ortopedia, Psychiatria Dziecięca, Genetyka Kliniczna.',
 'Lekarski', 3, 'Lekarski (Collegium Medicum), III rok',
 '2026-09-20 08:00:00+02', '2026-09-23 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.wl.uj.edu.pl', 'obieralne'),

('Lekarski VI rok — staż kierunkowy',
 'Zapis na staż kierunkowy w wybranej dziedzinie. Limity miejsc w klinikach. Decyduje średnia + kolejność.',
 'Lekarski', 6, 'Lekarski, VI rok',
 '2026-09-15 10:00:00+02', '2026-09-19 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 null, 'specjalizacja'),

('Farmacja IV rok — specjalizacja apteczna',
 'Wybór modułu specjalizacyjnego: Farmacja Apteczna, Farmacja Szpitalna, Analiza Leku, Toksykologia, Kosmetologia Stosowana.',
 'Farmacja', 4, 'Farmacja (Collegium Medicum), IV rok',
 '2026-09-21 14:00:00+02', '2026-09-24 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.farmacja.cm-uj.krakow.pl', 'specjalizacja'),

('Stomatologia III rok — pracownia kliniczna',
 'Zapis na grupę kliniczną. Wybór terminu praktyk w klinice stomatologicznej UJ. Limit 6-8 osób na grupę.',
 'Stomatologia', 3, 'Stomatologia (Collegium Medicum), III rok',
 '2026-09-19 09:00:00+02', '2026-09-22 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.stomatologia.cm-uj.krakow.pl', 'inne'),

('Pielęgniarstwo II rok — praktyki kliniczne',
 'Zapis na praktyki w szpitalach (oddziały: internistyczny, chirurgiczny, pediatryczny, ginekologiczno-położniczy, anestezjologii i intensywnej terapii).',
 'Pielęgniarstwo', 2, 'Pielęgniarstwo (Collegium Medicum), II rok',
 '2026-09-23 12:00:00+02', '2026-09-26 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.wnz.cm-uj.krakow.pl', 'inne'),

-- ──────────────────────────────────────────────────────────────────────
-- Ogólnouczelniane
-- ──────────────────────────────────────────────────────────────────────
('Przedmioty Ogólnouniwersyteckie (POJ) — sem. zimowy',
 'Wybór 1 przedmiotu z katalogu ogólnouniwersyteckiego (np. Historia Krakowa, Filozofia Antyczna, Wstęp do Programowania, Etyka w Biznesie, Kompetencje Miękkie). Dla wszystkich kierunków I-II stopnia.',
 null, null, 'Wszyscy studenci I-II stopnia',
 '2026-09-25 13:00:00+02', '2026-09-30 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.uj.edu.pl/studenci', 'inne'),

('Erasmus+ outbound — uczelnie europejskie',
 'Główna rekrutacja na wyjazdy Erasmus+ na cały rok akademicki 2027/28. Lista 300+ uczelni partnerskich. Wymagana znajomość języka B2 + min. średnia 4.0. Załączyć CV + list motywacyjny.',
 null, null, 'Wszyscy studenci po I roku',
 '2026-11-10 09:00:00+01', '2026-12-10 23:59:00+01',
 'https://erasmus.uj.edu.pl/rejestracja',
 'https://erasmus.uj.edu.pl', 'inne'),

('Przedmiot z innego wydziału (POW)',
 'Zapis na przedmiot z dowolnego kierunku UJ jako "z innego wydziału". Limit: zwykle 1-3 ECTS, w zależności od kierunku macierzystego.',
 null, null, 'Wszyscy studenci',
 '2026-09-26 13:00:00+02', '2026-09-30 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 null, 'inne'),

('Praktyki obowiązkowe — wakacje 2027',
 'Zapis miejsca praktyk obowiązkowych (4 tygodnie) na okres lipiec-sierpień 2027. Możliwe firmy / instytucje partnerskie UJ lub własna propozycja (wymaga akceptacji).',
 null, null, 'Wszyscy studenci kierunków z obowiązkowymi praktykami',
 '2026-12-01 10:00:00+01', '2027-01-31 23:59:00+01',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://www.uj.edu.pl/studenci/praktyki', 'inne'),

('Biblioteka Jagiellońska — szkolenie BHP biblioteczne',
 'Obowiązkowe szkolenie biblioteczne BJ dla I roku. Wybór terminu (kilka grup do wyboru). Brak zapisu = brak dostępu do magazynów BJ.',
 null, 1, 'Wszyscy studenci I roku I stopnia oraz jednolitych magisterskich',
 '2026-10-01 09:00:00+02', '2026-10-15 23:59:00+02',
 'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
 'https://bj.uj.edu.pl', 'inne')

) as v(title, description, study_program, year, audience_label, opens_at, closes_at, registration_url, info_url, kind)
where not exists (
  select 1 from public.usos_registrations r where r.title = v.title
);
