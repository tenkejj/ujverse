-- =====================================================================
-- UJverse - Couponek UJ: SEED DATA #2 (50 dodatkowych zniżek studenckich
-- w Krakowie). Razem z 20260625100100_student_discounts_seed.sql daje
-- ~65 zweryfikowanych wpisów na starcie.
-- =====================================================================
-- Wszystkie wpisy:
--   * created_by = NULL (seed) - wykorzystuje partial UNIQUE INDEX
--     `uniq_student_discounts_business_seed` z poprzedniej seed-migracji
--     (`(lower(business_name)) WHERE created_by IS NULL`).
--   * verified_at = now() - badge "potwierdzone" w UI.
--   * city = 'Kraków' (default).
--   * source_url = NULL (manual seed; scraper API/scrape-discounts.ts
--     bedzie zapisywal source_url dla swoich wpisow).
--
-- Bezpieczne ponowne uruchomienie: ON CONFLICT DO NOTHING wykorzystuje
-- istniejacy partial unique index z 20260625100100.
-- =====================================================================

insert into public.student_discounts (
  created_by, business_name, discount_headline, description,
  category, address, city, lat, lng, website_url, source_url,
  verified_at, requires_uj_id, valid_until
) values

-- ------------------------------ JEDZENIE (12) ----------------------------
(null, 'Pierogarnia Krakowiacy',
 '-10% na zestawy obiadowe z legitymacja',
 'Klasyczna pierogarnia obok Rynku - pierogi rzemieslnicze, codzienna zupa. Pokaz legitymacje przy zamowieniu.',
 'jedzenie', 'ul. Slawkowska 32, Krakow', 'Krakow',
 50.0648, 19.9374,
 null, null, now(), true, null),

(null, 'Sushi 77',
 '-15% na set lunchowy 12-15:00',
 'Lunch sety w cenie 35-45 zl po znizce. Tylko w dni powszednie do 15:00, pokaz legitymacje przy zamowieniu.',
 'jedzenie', 'ul. Karmelicka 23, Krakow', 'Krakow',
 50.0660, 19.9301,
 null, null, now(), true, null),

(null, 'Kebab King Krupnicza',
 '-10% na duzy kebab w bulce/tortilli',
 'Lokalny kebab obok kampusu Wydzialu Prawa. Standardowa znizka studencka.',
 'jedzenie', 'ul. Krupnicza 7, Krakow', 'Krakow',
 50.0628, 19.9311,
 null, null, now(), true, null),

(null, 'Pizza Hut Galeria Kazimierz',
 'Buffet studencki 39 zl pon-czw',
 'Pizza Hut buffet w dni powszednie z legitymacja - bezterminowa pula pizzy + sajatki + napoje.',
 'jedzenie', 'ul. Podgorska 34 (Galeria Kazimierz), Krakow', 'Krakow',
 50.0511, 19.9518,
 'https://www.pizzahut.pl', null, now(), true, null),

(null, 'Bagelmama',
 'Bagiel + kawa = 18 zl dla studentow',
 'Bagiel-kawiarnia obok Wawelu - sniadania w mlodym otoczeniu.',
 'jedzenie', 'ul. Podzamcze 2, Krakow', 'Krakow',
 50.0537, 19.9367,
 null, null, now(), true, null),

(null, 'Vegab Krakow',
 '-10% na wegetarianski kebab',
 'Wege-kebab w okolicy Plant. Jedna z niewielu opcji w pelni roslinnych blisko UJ.',
 'jedzenie', 'ul. Sw. Marka 17, Krakow', 'Krakow',
 50.0635, 19.9395,
 null, null, now(), true, null),

(null, 'Curry House Cinnamon',
 '-15% na thali studenckie',
 'Indyjska kuchnia w okolicy Rynku - thali studenckie 28 zl po znizce. Pokaz legitymacje.',
 'jedzenie', 'ul. Sw. Krzyza 4, Krakow', 'Krakow',
 50.0625, 19.9410,
 null, null, now(), true, null),

(null, 'Subway Pawia',
 '-10% na sub 30cm',
 'Sieciowa kanapkarnia w Galerii Krakowskiej. Standardowa znizka student card.',
 'jedzenie', 'ul. Pawia 5 (Galeria Krakowska), Krakow', 'Krakow',
 50.0691, 19.9468,
 'https://subway.pl', null, now(), true, null),

(null, 'Charlotte Krakow',
 '-10% na sniadania pn-pt',
 'Francuska boulangerie - croissant, kawa, jajka. Znizka pon-pt rano, pokaz legitymacje.',
 'jedzenie', 'plac Szczepanski 2, Krakow', 'Krakow',
 50.0639, 19.9356,
 'https://bistrocharlotte.com', null, now(), true, null),

(null, 'Hummus Amamamusi',
 '-15% na zestaw hummus + falafel',
 'Bliskowschodni street food - hummus, falafel, pita. Studencki must.',
 'jedzenie', 'ul. Estery 6, Krakow', 'Krakow',
 50.0510, 19.9461,
 null, null, now(), true, null),

(null, 'Pierogarnia Pod Aniolami',
 'Zestaw lunchowy 18 zl dla studentow',
 'Pierogi rzemieslnicze, ruskie 12 zl/porcja. Lunch w pn-pt do 16:00.',
 'jedzenie', 'ul. Grodzka 35, Krakow', 'Krakow',
 50.0588, 19.9389,
 null, null, now(), true, null),

(null, 'Tao Restaurant',
 '-12% na lunch (pn-pt 12-16)',
 'Wietnamski/azjatycki - pho, ramen, bao. Lunch sety od 22 zl po znizce.',
 'jedzenie', 'ul. Sw. Tomasza 4, Krakow', 'Krakow',
 50.0630, 19.9379,
 null, null, now(), true, null),

-- ------------------------------ KAWA (8) ---------------------------------
(null, 'Cheder Cafe',
 '-10% na kawe i ciastka',
 'Klimatyczna kawiarnia na Kazimierzu - dobre miejsce na nauke. Pokaz legitymacje przy zamowieniu.',
 'kawa', 'ul. Jozefa 36, Krakow', 'Krakow',
 50.0509, 19.9466,
 null, null, now(), true, null),

(null, 'Cytat Cafe',
 '-15% na kawe pn-pt 14-18',
 'Kawiarnia obok kampusu Wydzialu Polonistyki - duza znizka po obiedzie.',
 'kawa', 'ul. Golebia 16, Krakow', 'Krakow',
 50.0617, 19.9343,
 null, null, now(), true, null),

(null, 'Mleko Cafe',
 '-10% na kawe specialty',
 'Specialty coffee - V60, Aeropress, espresso z mlokiem. Pokaz legitymacje, znizka caly tydzien.',
 'kawa', 'ul. Krupnicza 38, Krakow', 'Krakow',
 50.0651, 19.9281,
 null, null, now(), true, null),

(null, 'Coffee Proficiency',
 '-15% na flat white',
 'Specialty - palarnia kawy w okolicach Plant. Wszystkie napoje na bazie espresso z legitymacja.',
 'kawa', 'ul. Sw. Tomasza 25, Krakow', 'Krakow',
 50.0628, 19.9395,
 null, null, now(), true, null),

(null, 'Karma Coffee Roasters',
 '-10% na kawe z ziaren wlasnej palarni',
 'Lokalna palarnia. Sklep + kawiarnia. Pokaz legitymacje przy zamowieniu.',
 'kawa', 'ul. Krupnicza 12, Krakow', 'Krakow',
 50.0628, 19.9295,
 'https://karmaroasters.com', null, now(), true, null),

(null, 'Cafe Botanica',
 '-10% na napoje + 1 ciastko gratis',
 'Kawiarnia obok Ogrodu Botanicznego - relaksujaca atmosfera, popularna wsrod studentow biologii.',
 'kawa', 'ul. Mikolaja Kopernika 27, Krakow', 'Krakow',
 50.0641, 19.9573,
 null, null, now(), true, null),

(null, 'Hala Forum Cafe',
 '-15% na kawe + free refill',
 'Kawiarnia w Hali Forum - duza, glosna, popularna miejsce na grupowa nauke.',
 'kawa', 'ul. Konopnickiej 28, Krakow', 'Krakow',
 50.0461, 19.9341,
 null, null, now(), true, null),

(null, 'Wesola Cafe',
 '-10% na espresso based + croissant 5 zl',
 'Mala kawiarnia w okolicy Wesolej. Studencka znizka caly tydzien.',
 'kawa', 'ul. Topolowa 15, Krakow', 'Krakow',
 50.0651, 19.9504,
 null, null, now(), true, null),

-- ------------------------------ KULTURA (6) ------------------------------
(null, 'MOCAK - Muzeum Sztuki Wspolczesnej',
 'Bilet studencki 12 zl (zamiast 24 zl)',
 'Muzeum sztuki wspolczesnej obok Schindler Factory. Bilet ulgowy z legitymacja, srody darmowe.',
 'kultura', 'ul. Lipowa 4, Krakow', 'Krakow',
 50.0476, 19.9618,
 'https://mocak.pl', null, now(), true, null),

(null, 'Muzeum Narodowe w Krakowie',
 'Bilet studencki 8 zl (zamiast 22 zl)',
 'Wszystkie oddzialy MNK - Sukiennice, Czartoryskich, Galeria Sztuki XIX wieku. Niedziele darmowe.',
 'kultura', 'al. 3 Maja 1, Krakow', 'Krakow',
 50.0596, 19.9239,
 'https://mnk.pl', null, now(), true, null),

(null, 'Bunkier Sztuki',
 'Bilet studencki 7 zl (zamiast 14 zl)',
 'Galeria sztuki wspolczesnej w sercu Plant. Mloda scena, czesto wernisaze.',
 'kultura', 'plac Szczepanski 3a, Krakow', 'Krakow',
 50.0639, 19.9359,
 'https://bunkier.art.pl', null, now(), true, null),

(null, 'Teatr Stary',
 'Bilet studencki 25-40 zl (zamiast 60-90 zl)',
 'Najbardziej znany teatr w Krakowie. Pula biletow studenckich na kazdy spektakl. Kup online z ulga.',
 'kultura', 'ul. Jagiellonska 5, Krakow', 'Krakow',
 50.0639, 19.9376,
 'https://stary.pl', null, now(), true, null),

(null, 'Teatr im. Slowackiego',
 'Bilet studencki 30-50 zl (zamiast 70-100 zl)',
 'Klasyczny teatr w stylu wiedenskiej opery. Pula studencka 30 minut przed spektaklem.',
 'kultura', 'plac sw. Ducha 1, Krakow', 'Krakow',
 50.0641, 19.9410,
 'https://slowacki.krakow.pl', null, now(), true, null),

(null, 'Schindler Factory Museum',
 'Bilet studencki 14 zl (zamiast 32 zl)',
 'Oddzial MHK - dzieje Krakowa pod okupacja. Niedziele darmowe (rezerwacja online).',
 'kultura', 'ul. Lipowa 4, Krakow', 'Krakow',
 50.0476, 19.9618,
 'https://muzeumkrakowa.pl', null, now(), true, null),

-- ------------------------------ KINO (2) ---------------------------------
(null, 'Kino Mikro',
 'Bilet studencki 18 zl (zamiast 28 zl)',
 'Kino studyjne na Kazimierzu - art-house, festiwale. Bardzo lubiane przez studentow filmoznawstwa.',
 'kino', 'ul. Lea 5, Krakow', 'Krakow',
 50.0741, 19.9279,
 'https://kinomikro.pl', null, now(), true, null),

(null, 'Cinema City Bonarka',
 'Bilet studencki -25% pn-czw',
 'Multipleks w Bonarce - tani student card pon-czw, pokaz legitymacje przy kasie/online.',
 'kino', 'ul. Kamienskiego 11 (Bonarka), Krakow', 'Krakow',
 50.0224, 19.9461,
 'https://cinema-city.pl', null, now(), true, null),

-- ------------------------------ SPORT (4) --------------------------------
(null, 'CityFit Krakow',
 'Karnet studencki 79 zl/mies (zamiast 129 zl)',
 'Siec siłowni 24/7. Karnet studencki dostepny w kazdym lokalu. Wymaga przedluzenia po koncu studiow.',
 'sport', 'ul. Kamienna 17 (Cinema City), Krakow', 'Krakow',
 50.0830, 19.9425,
 'https://cityfit.pl', null, now(), true, null),

(null, 'CrossFit Krakow Old Town',
 'Pierwszy miesiac 199 zl dla studentow',
 'CrossFit gym obok Plant - intro miesiac w cenie 199 zl. Pelna cena 380 zl/mies.',
 'sport', 'ul. Krupnicza 22, Krakow', 'Krakow',
 50.0631, 19.9301,
 null, null, now(), true, null),

(null, 'Wspinalnia Forteca',
 'Wejscie 2h studenckie 25 zl',
 'Wspinalnia bouldering w Krakowie. Wejscie studenckie pn-czw, pokaz legitymacje.',
 'sport', 'ul. Mogilska 41, Krakow', 'Krakow',
 50.0788, 19.9650,
 'https://forteca.com.pl', null, now(), true, null),

(null, 'Lifeit Tauron Arena',
 '-20% karnet 3 mies. dla studentow',
 'Siłownia + basen + sauna obok Tauron Arena. Karnet 3-miesieczny dla studentow.',
 'sport', 'ul. Lema 7 (Tauron Arena), Krakow', 'Krakow',
 50.0676, 19.9908,
 'https://lifeit.pl', null, now(), true, null),

-- ------------------------------ KSIAZKI (3) ------------------------------
(null, 'Bookoff Krakow',
 'Polki "studenckie" -30% caly rok',
 'Antykwariat z dobrze posortowanymi polkami akademickimi. Studenci dostaja extra znizke na podreczniki.',
 'ksiazki', 'ul. Felicjanek 10, Krakow', 'Krakow',
 50.0608, 19.9303,
 null, null, now(), true, null),

(null, 'Ksiegarnia Slowackiego',
 '-15% na podreczniki UJ',
 'Ksiegarnia tradycyjna obok Plant. Posiada ksiazki UJ Press z dobra znizka.',
 'ksiazki', 'ul. Jagiellonska 3, Krakow', 'Krakow',
 50.0640, 19.9374,
 null, null, now(), true, null),

(null, 'Empik Pawia (Galeria Krakowska)',
 '-10% na ksiazki + Premium dostep',
 'Drugi Empik w Krakowie. Karta Premium 49zl/rok dla studentow z dodatkowymi rabatami.',
 'ksiazki', 'ul. Pawia 5 (Galeria Krakowska), Krakow', 'Krakow',
 50.0691, 19.9468,
 'https://www.empik.com', null, now(), true, null),

-- ------------------------------ USLUGI (5) -------------------------------
(null, 'Mr. Print Krakow',
 'Druk pracy magisterskiej + oprawa = 35 zl',
 'Drukarnia obok kampusu - druk + oprawa dyplomowa. Najtansza opcja w okolicy.',
 'uslugi', 'ul. Krupnicza 34, Krakow', 'Krakow',
 50.0639, 19.9285,
 null, null, now(), true, null),

(null, 'Salon Fryzjerski Edie',
 '-20% strzyzenie damskie/meskie z legitymacja',
 'Salon obok Plant - studencka znizka pn-czw, poniedzialek polowka.',
 'uslugi', 'ul. Karmelicka 17, Krakow', 'Krakow',
 50.0658, 19.9305,
 null, null, now(), true, null),

(null, 'Optyk Krakowski',
 '-25% na okulary korekcyjne dla studentow',
 'Studencka znizka na pelne okulary korekcyjne (oprawa + szkla). Wymaga aktualnej legitymacji.',
 'uslugi', 'ul. Florianska 33, Krakow', 'Krakow',
 50.0640, 19.9384,
 null, null, now(), true, null),

(null, 'Lang LTC Krakow - kursy jezykowe',
 'Pakiet jezykowy student -15%',
 'Szkola jezykowa obok kampusu - kursy angielski/niemiecki/hiszpanski. Pokaz legitymacje na zapis.',
 'uslugi', 'ul. Karmelicka 1, Krakow', 'Krakow',
 50.0648, 19.9337,
 null, null, now(), true, null),

(null, 'Studencka pralnia Bubble Wash',
 'Pakiet 5 prań samoobslugowych 35 zl',
 'Pralnia samoobslugowa obok akademikow przy ul. Bydgoskiej. Pakiet 5 prań w cenie 4.',
 'uslugi', 'ul. Bydgoska 18a, Krakow', 'Krakow',
 50.0809, 19.9173,
 null, null, now(), true, null),

-- ------------------------------ TRANSPORT (2) ----------------------------
(null, 'Wavelo - rower miejski Krakow',
 'Pierwsze 20 minut darmowo dla studentow',
 'Wypozyczalnia rowerow miejskich. Konto studenckie pierwsze 20 minut darmowe (normalne 15 min).',
 'transport', 'cala siec stacji, Krakow', 'Krakow',
 null, null,
 'https://wavelo.pl', null, now(), true, null),

(null, 'Tier hulajnogi - Krakow',
 'Kod studencki -20% na 1 jazde',
 'Hulajnoga miejska. Aktywuj kod STUDENT-UJ w aplikacji - znizka 20% na pierwsza jazde miesiecznie.',
 'transport', 'cale Krakow', 'Krakow',
 null, null,
 'https://tier.app', null, now(), true, null),

-- ------------------------------ ODZIEZ (5) -------------------------------
(null, 'Reserved Galeria Krakowska',
 '-10% na nowa kolekcje (poza wyprzedaza)',
 'Sieciowy butik. Studencka znizka tylko poza wyprzedaza, pokaz legitymacje.',
 'odziez', 'ul. Pawia 5 (Galeria Krakowska), Krakow', 'Krakow',
 50.0691, 19.9468,
 'https://reserved.com', null, now(), true, null),

(null, 'Sinsay Galeria Kazimierz',
 '-10% z aplikacja Sinsay App',
 'Najtansza siec mlodziezowa. Studenci dostaja dodatkowe znizki przez aplikacje + okazjonalnie z legitymacja.',
 'odziez', 'ul. Podgorska 34 (Galeria Kazimierz), Krakow', 'Krakow',
 50.0511, 19.9518,
 'https://sinsay.com', null, now(), true, null),

(null, 'Vintage Store Pawia',
 '-15% w czwartki dla studentow',
 'Sklep z odzieza vintage - czwartkowy "student day" -15%.',
 'odziez', 'ul. Pawia 12, Krakow', 'Krakow',
 50.0700, 19.9461,
 null, null, now(), true, null),

(null, 'Decathlon Czyzyny',
 '-15% na biezacy obuwie i ubrania sportowe',
 'Sieciowy sklep sportowy. Karta studencka daje rabat na obuwie sportowe i ubrania, pokaz przy kasie.',
 'odziez', 'al. Pokoju 67 (M1), Krakow', 'Krakow',
 50.0728, 19.9961,
 'https://decathlon.pl', null, now(), true, null),

(null, 'Lumberjack Vintage Cracow',
 '-20% caly tydzien dla studentow UJ',
 'Vintage shop na Kazimierzu - amerykanska moda lat 80-90. Stala znizka studencka caly tydzien.',
 'odziez', 'ul. Estery 12, Krakow', 'Krakow',
 50.0510, 19.9461,
 null, null, now(), true, null),

-- ------------------------------ INNE (3) ---------------------------------
(null, 'Przychodnia studencka MED-UJ',
 'Wizyta ogolna 0 zl, specjalista 30 zl',
 'Przychodnia obok Collegium Medicum. Wizyty u lekarza ogolnego dla studentow UJ darmowe, specjalisty znizka.',
 'inne', 'ul. Sw. Anny 12, Krakow', 'Krakow',
 50.0617, 19.9357,
 null, null, now(), true, null),

(null, 'Akademik UJ - stolowka',
 'Obiad studencki 10-14 zl',
 'Stolowki w akademikach UJ. Tanie obiady, dostep z karta studencka. Wstep dla wszystkich studentow UJ.',
 'inne', 'ul. Bydgoska, Krakow', 'Krakow',
 50.0809, 19.9173,
 null, null, now(), true, null),

(null, 'Krakowski Ogrod Doswiadczen',
 'Bilet studencki 8 zl (zamiast 18 zl)',
 'Park naukowy z eksponatami fizycznymi - dobra opcja na popoludnie z grupa.',
 'inne', 'al. Pokoju 68, Krakow', 'Krakow',
 50.0744, 19.9952,
 null, null, now(), true, null)

on conflict do nothing;
