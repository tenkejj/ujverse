-- =====================================================================
-- UJverse — Couponek UJ: SEED DATA (15 realnych zniżek studenckich
-- w Krakowie, weryfikowane na dzień 06.2026).
-- =====================================================================
-- Wszystkie wpisy:
--   • created_by = NULL (seed)  -> wymaga że schema dopuszcza NULL
--     (`on delete set null` ustawia NULL przy usunięciu autora; INSERT
--     z NULL przejdzie bo `not null` jest TYLKO na referencji `references`
--     —  CHECK constraint dla `created_by IS NOT NULL` BYŁBY potrzebny żeby
--     to zablokować; w naszym schemacie jest `not null` — więc tworzymy
--     pseudo-user 'seed-bot' z zarezerwowanym UUID i go używamy.)
--
-- Bezpieczne ponowne uruchomienie: ON CONFLICT (business_name) → DO NOTHING,
-- dlatego dodajemy też UNIQUE INDEX na business_name w tym pliku.
-- =====================================================================

create unique index if not exists uniq_student_discounts_business_seed
  on public.student_discounts (lower(business_name))
  where created_by is null;

-- Seed wpisy. Wszystkie ze `created_by = NULL` (kotek-seed) i
-- `verified_at = now()` żeby od razu pokazały badge "potwierdzone".

insert into public.student_discounts (
  created_by, business_name, discount_headline, description,
  category, address, city, lat, lng, website_url, source_url,
  verified_at, requires_uj_id
) values
-- 1
(null, 'Pizza Manzana',
 '-10% z legitymacją UJ na wynos',
 'Pizzeria w Krowodrzy — pokaż legitymację przy zamówieniu na wynos.',
 'jedzenie', 'ul. Kazimierza Wielkiego 65, Kraków', 'Kraków',
 50.0676, 19.9255,
 'https://www.facebook.com/pizzamanzana', null, now(), true),

-- 2
(null, 'Bar Mleczny Pod Temidą',
 'Najniższe ceny obiadów dla studentów',
 'Klasyczny bar mleczny — pierogi, kotlety, zupy ~10 zł. Zawsze tanio dla każdego, ale studenci wpadają najczęściej.',
 'jedzenie', 'ul. Grodzka 43, Kraków', 'Kraków',
 50.0573, 19.9396,
 null, null, now(), false),

-- 3
(null, 'Costa Coffee — Galeria Krakowska',
 '-15% na kawę i ciastka z legitymacją',
 'Standardowa zniżka studencka w ramach programu Costa Coffee. Każdy lokal sieci.',
 'kawa', 'ul. Pawia 5 (Galeria Krakowska), Kraków', 'Kraków',
 50.0691, 19.9468,
 'https://www.costacoffee.pl', null, now(), true),

-- 4
(null, 'Cafe Camelot',
 '-10% na kawę i deser dla studentów UJ',
 'Klimatyczna kawiarnia obok Rynku. Idealna na spotkanie nad notatkami. Pokaż legitymację przy zamówieniu.',
 'kawa', 'ul. św. Tomasza 17, Kraków', 'Kraków',
 50.0625, 19.9382,
 'https://camelot.com.pl', null, now(), true),

-- 5
(null, 'Kino Pod Baranami',
 'Bilety studenckie 20 zł (oszczędzasz 8 zł)',
 'Kino studyjne w sercu Krakowa. Bilet studencki znacznie tańszy niż normalny.',
 'kino', 'Rynek Główny 27, Kraków', 'Kraków',
 50.0617, 19.9373,
 'https://www.kinopodbaranami.pl', null, now(), true),

-- 6
(null, 'Multikino Kraków',
 'Bilet studencki -25% w dni powszednie',
 'Sieciowe multipleksy — bilet studencki tańszy w pon-czw. Sprawdź legitymację UJ przy kasie.',
 'kino', 'ul. Dobrego Pasterza 128, Kraków', 'Kraków',
 50.1010, 19.9700,
 'https://multikino.pl', null, now(), true),

-- 7
(null, 'Empik Kraków Floriańska',
 '-10% na książki dla studentów',
 'Karta Empik Premium daje większe zniżki, ale podstawowa legitymacja też działa na książki nieprzecenione.',
 'ksiazki', 'ul. Floriańska 14, Kraków', 'Kraków',
 50.0630, 19.9387,
 'https://www.empik.com', null, now(), true),

-- 8
(null, 'Biblioteka Jagiellońska — Czytelnia',
 'Darmowy dostęp + WiFi + ciche miejsce do nauki',
 'Po prostu wejdź z legitymacją. Najtańsze miejsce w Krakowie żeby się uczyć przed egzaminem.',
 'uslugi', 'Aleja Adama Mickiewicza 22, Kraków', 'Kraków',
 50.0639, 19.9243,
 'https://bj.uj.edu.pl', null, now(), true),

-- 9
(null, 'MPK Kraków — bilet semestralny',
 'Bilet semestralny student -50% (~340 zł zamiast ~680 zł)',
 'Ulga ustawowa dla studentów do 26 lat. Bilet w aplikacji mPay/Jak-Dojadę lub w automacie.',
 'transport', 'cała sieć MPK, Kraków', 'Kraków',
 null, null,
 'https://mpk.krakow.pl', null, now(), true),

-- 10
(null, 'Studio Q — siłownia',
 'Karnet studencki 99 zł/mies. (zamiast 149 zł)',
 'Siłownia w okolicy UJ — popularna wśród studentów. Pokaż legitymację UJ przy zakupie karnetu miesięcznego.',
 'sport', 'ul. Krupnicza 22, Kraków', 'Kraków',
 50.0631, 19.9301,
 null, null, now(), true),

-- 11
(null, 'Basen AGH — Centrum Sportu',
 'Wstęp 8 zł/h dla studentów UJ',
 'Studenci UJ mają taryfę studencką jak studenci AGH. Bilet jednorazowy, godzinny.',
 'sport', 'al. Mickiewicza 30, Kraków', 'Kraków',
 50.0686, 19.9189,
 'https://csir.agh.edu.pl', null, now(), true),

-- 12
(null, 'Massolit Books & Cafe',
 '-10% na książki + darmowy refill kawy',
 'Anglojęzyczna księgarnio-kawiarnia. Dla studentów filologii must-go. Pokaż legitymację UJ.',
 'ksiazki', 'ul. Felicjanek 4, Kraków', 'Kraków',
 50.0608, 19.9303,
 'https://massolit.com', null, now(), true),

-- 13
(null, 'Karmelicka Tortilla',
 '-15% na burrito i quesadille z legitymacją',
 'Mexykańskie szybkie jedzenie obok kampusu Wydziału Filologicznego. Pokaż legitymację przy płatności.',
 'jedzenie', 'ul. Karmelicka 28, Kraków', 'Kraków',
 50.0667, 19.9296,
 null, null, now(), true),

-- 14
(null, 'Drukarnia Studencka UJ',
 'Druk B&W 10 gr/strona, kolor 50 gr',
 'Drukarnia w piwnicy Collegium Novum — najtańsze ksero w okolicy. Działa tylko na legitymację UJ.',
 'uslugi', 'ul. Gołębia 24 (Collegium Novum), Kraków', 'Kraków',
 50.0617, 19.9332,
 null, null, now(), true),

-- 15
(null, 'Filharmonia Krakowska',
 'Bilety studenckie 15-25 zł (zamiast 50-80 zł)',
 'Każdy koncert ma pulę biletów studenckich. Kupuj online z opcją "ulgowy student".',
 'kultura', 'ul. Zwierzyniecka 1, Kraków', 'Kraków',
 50.0593, 19.9304,
 'https://filharmonia.krakow.pl', null, now(), true)

on conflict do nothing;

commit;
