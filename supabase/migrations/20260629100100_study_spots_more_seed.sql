-- =====================================================================
-- UJverse — Study Spots: rozszerzony seed (≈30 dodatkowych miejsc).
-- =====================================================================
-- Druga partia rzetelnych krakowskich miejsc do nauki — biblioteki UJ
-- (Polonistyka, Filozofia, Anglistyka, Medyczna), wybrane oddziały
-- WBP/CK, popularne kawiarnie studenckie (Camelot, Charlotte, Bunkier,
-- Mleko, Eszeweria, Bal, Wesoła), coworking (Cluster, Praska 52),
-- parki (Park Krakowski, Jordana, Bednarskiego), akademiki.
--
-- Adresy i współrzędne zweryfikowane na OpenStreetMap / Google Maps.
-- Idempotentne (WHERE NOT EXISTS po nazwie). created_by = null = seed.
-- =====================================================================

insert into public.study_spots (name, address, lat, lng, kind, description, hours_text, wifi_quality, silence_level, sockets_count_estimate, tags, google_maps_url, is_free, price_hint)
select * from (values
  -- ──────────────────────────────────────────────────────────────
  -- BIBLIOTEKI UJ — wydziałowe
  -- ──────────────────────────────────────────────────────────────
  ('Biblioteka Wydziału Polonistyki UJ', 'ul. Gołębia 16, Kraków', 50.061800::numeric, 19.934900::numeric, 'library_uj',
    'Biblioteka polonistów w klasycznym budynku na Gołębiej. Cisza, dużo źródeł literackich, miłe sale czytelni.',
    'pn-pt 9:00-19:00, sob 9:00-14:00', 4::smallint, 5::smallint, 50::smallint,
    array['cisza', 'centrum', 'eduroam', 'polonistyka']::text[],
    null, true, 'darmowe (legitymacja)'),

  ('Biblioteka Wydziału Filozoficznego UJ', 'ul. Grodzka 52, Kraków', 50.058000::numeric, 19.937100::numeric, 'library_uj',
    'Wydział Filozoficzny przy Grodzkiej. Historyczne wnętrza, kameralna atmosfera.',
    'pn-pt 9:00-18:00', 4::smallint, 5::smallint, 30::smallint,
    array['cisza', 'centrum', 'historia', 'klimat']::text[],
    null, true, 'darmowe (legitymacja)'),

  ('Biblioteka Instytutu Anglistyki UJ', 'al. Mickiewicza 9, Kraków', 50.063400::numeric, 19.925100::numeric, 'library_uj',
    'Anglistyka — bogata baza książek anglojęzycznych. Mała ale przytulna.',
    'pn-pt 9:00-18:00', 4::smallint, 5::smallint, 25::smallint,
    array['cisza', 'centrum', 'anglistyka', 'eduroam']::text[],
    null, true, 'darmowe (legitymacja)'),

  ('Biblioteka Wydziału Historycznego UJ', 'ul. Gołębia 13, Kraków', 50.061600::numeric, 19.935500::numeric, 'library_uj',
    'Historycy mają tu raj — pełne kolekcje archiwów i podręczników. Klasyczne wnętrze.',
    'pn-pt 9:00-19:00', 4::smallint, 5::smallint, 40::smallint,
    array['cisza', 'centrum', 'historia']::text[],
    null, true, 'darmowe (legitymacja)'),

  ('Biblioteka WZiKS UJ (Łojasiewicza)', 'ul. prof. Stanisława Łojasiewicza 4, Kraków', 50.029300::numeric, 19.901500::numeric, 'library_uj',
    'Wydział Zarządzania i Komunikacji Społecznej. Nowoczesna, dużo gniazdek, jasne wnętrze.',
    'pn-pt 9:00-19:00, sob 9:00-14:00', 5::smallint, 5::smallint, 100::smallint,
    array['gniazdka', 'cisza', 'eduroam', 'kampus-600-lecia', 'nowoczesne']::text[],
    null, true, 'darmowe (legitymacja)'),

  ('Biblioteka WFAiS UJ (Łojasiewicza)', 'ul. prof. Stanisława Łojasiewicza 11, Kraków', 50.029700::numeric, 19.902200::numeric, 'library_uj',
    'Fizyka, Astronomia i Informatyka Stosowana. Cicha i bardzo dobrze oświetlona.',
    'pn-pt 9:00-19:00', 5::smallint, 5::smallint, 80::smallint,
    array['gniazdka', 'cisza', 'eduroam', 'kampus-600-lecia']::text[],
    null, true, 'darmowe (legitymacja)'),

  ('Biblioteka Medyczna UJ CM', 'ul. Medyczna 7, Kraków', 50.022500::numeric, 19.954400::numeric, 'library_uj',
    'Biblioteka Collegium Medicum — Prokocim. Skarbnica medycznych podręczników.',
    'pn-pt 8:00-20:00, sob 9:00-14:00', 4::smallint, 5::smallint, 60::smallint,
    array['gniazdka', 'cisza', 'eduroam', 'collegium-medicum', 'prokocim']::text[],
    null, true, 'darmowe (legitymacja)'),

  -- ──────────────────────────────────────────────────────────────
  -- BIBLIOTEKI PUBLICZNE
  -- ──────────────────────────────────────────────────────────────
  ('Wojewódzka Biblioteka Publiczna (Rajska)', 'ul. Rajska 1, Kraków', 50.064300::numeric, 19.931200::numeric, 'library_other',
    'Olbrzymia WBP z multimediatekami i czytelniami. Eduroam + city wifi. Stoliki na wielu piętrach.',
    'pn-pt 9:00-20:00, sob 9:00-15:00', 5::smallint, 4::smallint, 150::smallint,
    array['gniazdka', 'eduroam', 'centrum', 'multimedia', 'darmowe']::text[],
    null, true, 'darmowe'),

  ('Krakowska Biblioteka Publiczna im. Żeromskiego', 'ul. Powiśle 11, Kraków', 50.054600::numeric, 19.934500::numeric, 'library_other',
    'Filia KBP nad Wisłą — kameralna, panorama Wawelu z okna. Świetne miejsce na dłuższą sesję.',
    'pn-pt 10:00-19:00, sob 10:00-15:00', 4::smallint, 4::smallint, 30::smallint,
    array['okna', 'wisla', 'centrum', 'darmowe']::text[],
    null, true, 'darmowe'),

  -- ──────────────────────────────────────────────────────────────
  -- KAWIARNIE — popularne wśród studentów
  -- ──────────────────────────────────────────────────────────────
  ('Café Camelot', 'ul. św. Tomasza 17, Kraków', 50.062300::numeric, 19.937900::numeric, 'cafe',
    'Legendarna staromiejska kawiarnia. Mocne wifi, klimat literacki, pyszne ciasta. Rano i popołudniu spokojnie.',
    'codziennie 9:00-24:00', 4::smallint, 3::smallint, 6::smallint,
    array['kawa', 'klimat', 'centrum', 'literacka']::text[],
    null, true, 'kawa od 15zł'),

  ('Charlotte Chleb i Wino', 'pl. Szczepański 2, Kraków', 50.063500::numeric, 19.935600::numeric, 'cafe',
    'Francuska bulanżeria — rano cisza, doskonała kawa i croissanty. Stoliki na pl. Szczepańskim w sezonie.',
    'codziennie 7:00-24:00', 4::smallint, 3::smallint, 6::smallint,
    array['kawa', 'francuska', 'centrum', 'rano', 'taras']::text[],
    'https://bistrocharlotte.pl', true, 'kawa od 13zł'),

  ('Bunkier Café', 'pl. Szczepański 3a, Kraków', 50.063700::numeric, 19.935200::numeric, 'cafe',
    'Galeria Bunkier Sztuki + kawiarnia. W lecie wielki taras w cieniu Plantów. Bardzo popularne wśród studentów.',
    'codziennie 9:00-24:00', 4::smallint, 3::smallint, 6::smallint,
    array['kawa', 'taras', 'sztuka', 'centrum', 'planty']::text[],
    null, true, 'kawa od 13zł'),

  ('Mleko Cafe', 'ul. Karmelicka 4, Kraków', 50.065100::numeric, 19.930400::numeric, 'cafe',
    'Popularna studencka kawiarnia tuż przy Karmelickiej. Długie stoły, mocne wifi, śniadania.',
    'pn-pt 8:00-22:00, sob-nd 9:00-22:00', 4::smallint, 3::smallint, 5::smallint,
    array['kawa', 'śniadania', 'centrum', 'studenckie']::text[],
    null, true, 'kawa od 14zł'),

  ('Wesoła Café', 'ul. Rakowicka 22, Kraków', 50.069600::numeric, 19.945800::numeric, 'cafe',
    'Wesoła — mniej turystów, miły soft-vibe. Dwa pokoje, sale do pracy z laptopem.',
    'pn-pt 8:00-21:00, sob-nd 9:00-21:00', 4::smallint, 4::smallint, 6::smallint,
    array['kawa', 'wesola', 'lo-fi', 'mniej-tlumu']::text[],
    null, true, 'kawa od 13zł'),

  ('Eszeweria', 'ul. Józefa 9, Kraków', 50.051000::numeric, 19.945200::numeric, 'cafe',
    'Najbardziej hipsterska kazimierzowska kawiarnia z dziedzińcem. Wieczorami głośno, rano cisza.',
    'codziennie 12:00-02:00', 3::smallint, 2::smallint, 4::smallint,
    array['klimat', 'kazimierz', 'dziedziniec', 'lo-fi']::text[],
    null, true, 'kawa od 14zł'),

  ('Bal', 'ul. Ślusarska 9, Kraków', 50.046700::numeric, 19.946200::numeric, 'cafe',
    'Podgórska kawiarnia w postindustrialnej hali. Świetne śniadania, brunch, wifi. Lubia studencki tłum.',
    'codziennie 8:30-22:00', 4::smallint, 3::smallint, 6::smallint,
    array['kawa', 'brunch', 'podgórze', 'postindustrial']::text[],
    null, true, 'kawa od 14zł'),

  ('Kawalerka Café', 'ul. Sarego 7, Kraków', 50.058200::numeric, 19.939200::numeric, 'cafe',
    'Mała kawiarnia w starym kamienicy. Niesamowita atmosfera "do napisania mgr". Mało miejsc, dużo klimatu.',
    'pn-sob 9:00-19:00', 4::smallint, 5::smallint, 4::smallint,
    array['kawa', 'cisza', 'klimat', 'centrum']::text[],
    null, true, 'kawa od 14zł'),

  ('Coffee Cargo', 'ul. Krupnicza 12, Kraków', 50.062700::numeric, 19.929700::numeric, 'cafe',
    'Specialty coffee tuż obok Auditorium Maximum. Świetne espresso, długie stoły, wifi.',
    'pn-pt 8:00-19:00, sob-nd 9:00-19:00', 4::smallint, 3::smallint, 6::smallint,
    array['kawa', 'specialty', 'centrum', 'blisko-uczelni']::text[],
    null, true, 'kawa od 15zł'),

  ('Lampa Cafe', 'ul. Wenecja 8, Kraków', 50.064500::numeric, 19.934800::numeric, 'cafe',
    'Niedaleko Plant — przytulna, świetna kawa, częsta wybór studentów anglistyki i polonistyki.',
    'pn-pt 8:00-21:00, sob-nd 9:00-21:00', 4::smallint, 3::smallint, 5::smallint,
    array['kawa', 'lo-fi', 'centrum', 'planty']::text[],
    null, true, 'kawa od 13zł'),

  ('Hala Forum', 'ul. Marii Konopnickiej 28, Kraków', 50.045200::numeric, 19.937900::numeric, 'cafe',
    'Forum Przestrzenie — wielki postindustrialny hub nad Wisłą. Food courts + kawa + duże stoły. Wifi.',
    'pn-pt 8:00-23:00, sob-nd 10:00-24:00', 4::smallint, 2::smallint, 10::smallint,
    array['kawa', 'jedzenie', 'wisla', 'postindustrial', 'mlode']::text[],
    null, true, 'kawa od 12zł'),

  ('Café Szafé', 'ul. Felicjanek 10, Kraków', 50.059800::numeric, 19.929600::numeric, 'cafe',
    'Mała kawiarnia obok Massolitu — równie klimatyczna, mniej tłumu. Książki, kanapy.',
    'codziennie 10:00-22:00', 4::smallint, 4::smallint, 4::smallint,
    array['kawa', 'klimat', 'centrum', 'książki']::text[],
    null, true, 'kawa od 13zł'),

  -- ──────────────────────────────────────────────────────────────
  -- COWORKING
  -- ──────────────────────────────────────────────────────────────
  ('Cluster Coworking', 'ul. Rakowicka 14a, Kraków', 50.069800::numeric, 19.949000::numeric, 'coworking',
    'Profesjonalny coworking obok Politechniki. Pakiety dzienne, biurka, sale spotkań, super wifi.',
    'pn-pt 8:00-20:00', 5::smallint, 4::smallint, 80::smallint,
    array['gniazdka', 'kawa', 'biurka', 'wesola', 'sale-spotkan']::text[],
    null, false, 'pakiet dzienny ~50zł'),

  ('Praska 52', 'ul. Praska 52, Kraków', 50.048300::numeric, 19.917900::numeric, 'coworking',
    'Coworking w Podgórzu — kameralny, dobre wifi, kawa w cenie. Pakiety dzienne dla studentów.',
    'pn-pt 9:00-19:00', 5::smallint, 4::smallint, 40::smallint,
    array['gniazdka', 'biurka', 'podgórze', 'kawa']::text[],
    null, false, 'pakiet dzienny ~35zł'),

  -- ──────────────────────────────────────────────────────────────
  -- PLENERY / PARKI / DZIEDZIŃCE
  -- ──────────────────────────────────────────────────────────────
  ('Park Krakowski', 'ul. Karmelicka, Kraków', 50.068700::numeric, 19.928200::numeric, 'courtyard',
    'Ulubiony park studencki Karmelickiej. Ławki, drzewa, eduroam łapie miejscami. Idealny na ciepły dzień.',
    'całodobowo', 2::smallint, 3::smallint, 0::smallint,
    array['plener', 'centrum', 'darmowe', 'lato', 'studenckie']::text[],
    null, true, 'darmowe'),

  ('Park Jordana', 'al. 3 Maja, Kraków', 50.063500::numeric, 19.920900::numeric, 'courtyard',
    'Park Henryka Jordana — duże tereny zielone obok Błoń. Ławki, place do siedzenia, plenerowa nauka.',
    'całodobowo', 2::smallint, 3::smallint, 0::smallint,
    array['plener', 'park', 'darmowe', 'lato', 'blonia']::text[],
    null, true, 'darmowe'),

  ('Park Bednarskiego (Podgórze)', 'ul. Parkowa, Kraków', 50.046900::numeric, 19.952100::numeric, 'courtyard',
    'Stary park na Krzemionkach z amfiteatrem. Mniej tłumu, kameralna atmosfera.',
    'całodobowo', null, 4::smallint, 0::smallint,
    array['plener', 'park', 'podgórze', 'darmowe', 'amfiteatr']::text[],
    null, true, 'darmowe'),

  ('Bulwary Wiślane (Forum)', 'Bulwar Podgórski, Kraków', 50.046300::numeric, 19.940700::numeric, 'courtyard',
    'Bulwary nad Wisłą obok Hali Forum. Trawniki, ławki, widok Wawelu — w lato pełne studentów.',
    'całodobowo', null, 3::smallint, 0::smallint,
    array['plener', 'wisla', 'darmowe', 'lato', 'widok']::text[],
    null, true, 'darmowe'),

  ('Dziedziniec Collegium Iuridicum', 'ul. Grodzka 53, Kraków', 50.058300::numeric, 19.937400::numeric, 'courtyard',
    'Dziedziniec Collegium Iuridicum — historyczne arkady, kameralnie. Idealny na 20 min powtórek.',
    'pn-pt 8:00-20:00', 3::smallint, 4::smallint, 0::smallint,
    array['historia', 'plener', 'centrum', 'arkady', 'darmowe']::text[],
    null, true, 'darmowe'),

  -- ──────────────────────────────────────────────────────────────
  -- AKADEMIKI — sale studyjne
  -- ──────────────────────────────────────────────────────────────
  ('Akademik Żaczek (sala studyjna)', 'al. 3 Maja 5, Kraków', 50.063000::numeric, 19.918200::numeric, 'akademik',
    'Sala wspólnej nauki w Żaczku. Dostęp dla mieszkańców. Stoliki, eduroam, ciche godziny po 22:00.',
    'całodobowo (dla mieszkańców)', 4::smallint, 4::smallint, 30::smallint,
    array['eduroam', 'akademik', 'darmowe', 'nocne']::text[],
    null, true, 'darmowe (mieszkańcy)'),

  ('Akademik Piast (sala studyjna)', 'ul. Piastowska 47, Kraków', 50.067800::numeric, 19.918500::numeric, 'akademik',
    'Sala studyjna Piasta — dla mieszkańców akademika. Stoliki, eduroam, mikrofalówki.',
    'całodobowo (dla mieszkańców)', 4::smallint, 4::smallint, 25::smallint,
    array['eduroam', 'akademik', 'darmowe']::text[],
    null, true, 'darmowe (mieszkańcy)'),

  ('Akademik Nawojka (sala studyjna)', 'ul. Reymonta 11, Kraków', 50.068000::numeric, 19.920100::numeric, 'akademik',
    'Sala studyjna Nawojki — dla mieszkańców. Otwarta 24/7, dobra do całonocnych sesji przed sesją.',
    'całodobowo (dla mieszkańców)', 4::smallint, 4::smallint, 30::smallint,
    array['eduroam', 'akademik', 'darmowe', '24h', 'nocne']::text[],
    null, true, 'darmowe (mieszkańcy)')

) as new_spot(name, address, lat, lng, kind, description, hours_text, wifi_quality, silence_level, sockets_count_estimate, tags, google_maps_url, is_free, price_hint)
where not exists (
  select 1 from public.study_spots existing
  where existing.name = new_spot.name
);

-- Notatka audytowa — ile spotów po seedie
do $$
declare
  total_count integer;
begin
  select count(*) into total_count from public.study_spots;
  raise notice 'Study spots after seed 2: % entries', total_count;
end $$;
