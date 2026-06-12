-- ──────────────────────────────────────────────────────────────────────────
-- UJ rooms — MASYWNA expansja (~600 nowych sal).
--
-- Wcześniejsze migracje miały razem ~200 sal/18 budynków — ~11 na budynek.
-- UJ buildings realnie mają dziesiątki / setki sal. Ta migracja generuje
-- proceduralnie sale per budynek wg lokalnej konwencji nazewnictwa,
-- żeby UI nie wyglądało jak "5 sal na całą uczelnię".
--
-- Konwencje (z poprzedniej migracji):
--   WMI Łojasiewicza 6:    4-cyfra, 1. cyfra = piętro (0001-0150, 1001-1150 …)
--   WFAIS Łojasiewicza 11: A-NNN, B-NN, F-NNN (skrzydło-piętro-nr)
--   WZiKS Łojasiewicza 4:  N.NN (floor.room)
--   WB Gronostajowa 9:     A/B/C-N-NN (skrzydło-piętro-nr) + nazwane aule
--   WCh Gronostajowa 2:    N.NN + nazwane aule (A,B,C)
--   WGG Gronostajowa 3a:   A/B/C-N-NN
--   WFil Mickiewicza 9-11: 3-cyfra (101, 202, 303)
--   WFz/IP Ingardena 6:    2-3 cyfra (12, 78, 100, 220)
--   WH Gołębia 13:         2-3 cyfra
--   WPol Gołębia 16:       2-3 cyfra + nazwane sale (Reja, Pollaka…)
--   WPiA Bracka 12:        2-3 cyfra + Refektarz, Sala Rady
--   WSMiP Reymonta 4:      2-3 cyfra
--   BJ Mickiewicza 22:     Cz* prefix (CzNH, CzNT) + Sala Konferencyjna
--   SWFiS Piastowska 26:   Nazwane (Hala, Siłownia, Fitness…)
--   CM Św. Anny 12:        Sala N + nazwane (Anatomiczna, CM…)
--   Aud.Max:               Aula Duża/Średnia/Mała/Tischnera + Sale konferencyjne
--   Collegium Maius:       Aule historyczne (Jagiellońska, Kazimierzowska…)
--   Collegium Novum:       2-3 cyfra + Aula Wróblewskiego, Sala Senacka
--
-- Capacity heuristyki:
--   - Aula nazwana: 150-500
--   - Sala wykładowa (pierwsze N w bloku): 60-100
--   - Sala ćwiczeniowa: 25-50
--   - Laboratorium: 18-30
--   - Sala seminaryjna/konferencyjna: 12-25
--
-- ON CONFLICT (building_id, code) DO NOTHING — istniejące wpisy zostają.
-- ──────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  f INT;
  n INT;
  cap INT;
  room_code TEXT;
  prefix TEXT;
BEGIN
  -- ════════════════════════════════════════════════════════════════════
  -- WMI Łojasiewicza 6 — 4 piętra × ~30 sal = ~120 sal
  -- Codes: F + 3-digit nr (np. 0085, 1023, 2177)
  -- ════════════════════════════════════════════════════════════════════
  FOR f IN 0..3 LOOP
    -- Sale wykładowe i ćwiczeniowe (numery 01-30)
    FOR n IN 1..30 LOOP
      room_code := f::TEXT || LPAD(n::TEXT, 3, '0');
      cap := CASE
        WHEN f = 3 THEN 30 -- 3.p głównie seminaryjne
        WHEN n <= 5 THEN 100 -- pierwsze duże wykładowe
        WHEN n <= 15 THEN 60
        ELSE 30
      END;
      INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
      VALUES ('lojasiewicza-6', room_code, 'Sala ' || room_code, f, cap)
      ON CONFLICT (building_id, code) DO NOTHING;
    END LOOP;
    -- Laboratoria/pracownie (numery 80-95) — tylko piętra 0-2
    IF f < 3 THEN
      FOR n IN 80..95 LOOP
        room_code := f::TEXT || LPAD(n::TEXT, 3, '0');
        INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity, notes)
        VALUES (
          'lojasiewicza-6', room_code, 'Pracownia ' || room_code, f, 24,
          'Pracownia komputerowa.'
        )
        ON CONFLICT (building_id, code) DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;

  -- ════════════════════════════════════════════════════════════════════
  -- WFAIS Łojasiewicza 11 — A-NNN (3 piętra), B-NN (basement labs), F-NNN
  -- ════════════════════════════════════════════════════════════════════
  -- Skrzydło A: A-001 (piwnica), A-101 (1.p), A-201 (2.p), A-301 (3.p)
  FOR f IN 0..3 LOOP
    FOR n IN 1..25 LOOP
      -- Format: piwnica/parter = A-0-NN, wyższe = A-1NN (3 cyfry, środkowa = piętro)
      IF f >= 1 THEN
        room_code := 'A-' || f::TEXT || LPAD(n::TEXT, 2, '0');
      ELSE
        room_code := 'A-0-' || LPAD(n::TEXT, 2, '0');
      END IF;
      cap := CASE
        WHEN n <= 3 THEN 100  -- duże wykładowe
        WHEN n <= 10 THEN 60
        WHEN n <= 18 THEN 40
        ELSE 25
      END;
      INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
      VALUES ('lojasiewicza-11', room_code, 'Sala ' || room_code, f, cap)
      ON CONFLICT (building_id, code) DO NOTHING;
    END LOOP;
  END LOOP;
  -- Skrzydło B (basement laboratoria fizyki)
  FOR n IN 5..30 LOOP
    room_code := 'B-' || LPAD(n::TEXT, 2, '0');
    INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity, notes)
    VALUES ('lojasiewicza-11', room_code, 'Pracownia ' || room_code, 0, 20, 'Laboratorium fizyki.')
    ON CONFLICT (building_id, code) DO NOTHING;
  END LOOP;
  -- F-prefix (laboratoria fizyki na piętrach)
  FOR f IN 1..3 LOOP
    FOR n IN 1..15 LOOP
      room_code := 'F-' || f::TEXT || LPAD(n::TEXT, 2, '0');
      INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity, notes)
      VALUES ('lojasiewicza-11', room_code, 'Pracownia ' || room_code, f, 18, 'Pracownia fizyczna.')
      ON CONFLICT (building_id, code) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ════════════════════════════════════════════════════════════════════
  -- WZiKS Łojasiewicza 4 — N.NN (4 piętra × ~50 sal = ~200)
  -- ════════════════════════════════════════════════════════════════════
  FOR f IN 0..3 LOOP
    FOR n IN 1..50 LOOP
      room_code := f::TEXT || '.' || LPAD(n::TEXT, 2, '0');
      cap := CASE
        WHEN n <= 5 THEN 80
        WHEN n <= 15 THEN 50
        WHEN n <= 30 THEN 30
        ELSE 20
      END;
      INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
      VALUES ('lojasiewicza-4', room_code, 'Sala ' || room_code, f, cap)
      ON CONFLICT (building_id, code) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ════════════════════════════════════════════════════════════════════
  -- WCh Gronostajowa 2 — N.NN + nazwane aule. ~80 sal.
  -- ════════════════════════════════════════════════════════════════════
  FOR f IN 0..3 LOOP
    FOR n IN 1..20 LOOP
      room_code := f::TEXT || '.' || LPAD(n::TEXT, 2, '0');
      cap := CASE
        WHEN n <= 3 THEN 80
        WHEN n <= 8 THEN 50
        WHEN n >= 15 THEN 24  -- labs
        ELSE 30
      END;
      INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity, notes)
      VALUES (
        'gronostajowa-2', room_code, 'Sala ' || room_code, f, cap,
        CASE WHEN n >= 15 THEN 'Pracownia chemiczna.' ELSE NULL END
      )
      ON CONFLICT (building_id, code) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ════════════════════════════════════════════════════════════════════
  -- WB Gronostajowa 9 — A/B/C-N-NN + pracownie. ~70 sal.
  -- ════════════════════════════════════════════════════════════════════
  FOREACH prefix IN ARRAY ARRAY['A', 'B', 'C'] LOOP
    FOR f IN 0..2 LOOP
      FOR n IN 1..10 LOOP
        room_code := prefix || '-' || f::TEXT || '-' || LPAD(n::TEXT, 2, '0');
        cap := CASE
          WHEN n <= 2 THEN 80
          WHEN n <= 5 THEN 50
          ELSE 30
        END;
        INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
        VALUES ('gronostajowa-9', room_code, 'Sala ' || room_code, f, cap)
        ON CONFLICT (building_id, code) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  -- ════════════════════════════════════════════════════════════════════
  -- WGG Gronostajowa 3a — A/B/C-N-NN. ~50 sal.
  -- ════════════════════════════════════════════════════════════════════
  FOREACH prefix IN ARRAY ARRAY['A', 'B', 'C'] LOOP
    FOR f IN 0..2 LOOP
      FOR n IN 1..8 LOOP
        room_code := prefix || '-' || f::TEXT || '-' || LPAD(n::TEXT, 2, '0');
        cap := CASE WHEN n <= 2 THEN 60 WHEN n <= 4 THEN 40 ELSE 25 END;
        INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
        VALUES ('gronostajowa-3a', room_code, 'Sala ' || room_code, f, cap)
        ON CONFLICT (building_id, code) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  -- ════════════════════════════════════════════════════════════════════
  -- WFil Mickiewicza 9-11 (Paderevianum) — 3-cyfra. ~60 sal.
  -- Numery 101-120, 201-220, 301-320, 401-415
  -- ════════════════════════════════════════════════════════════════════
  FOR f IN 1..3 LOOP
    FOR n IN 1..20 LOOP
      room_code := (f * 100 + n)::TEXT;
      cap := CASE WHEN n <= 3 THEN 80 WHEN n <= 10 THEN 50 ELSE 30 END;
      INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
      VALUES ('mickiewicza-9-11', room_code, 'Sala ' || room_code, f, cap)
      ON CONFLICT (building_id, code) DO NOTHING;
    END LOOP;
  END LOOP;
  FOR n IN 1..15 LOOP
    room_code := (400 + n)::TEXT;
    INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
    VALUES ('mickiewicza-9-11', room_code, 'Sala ' || room_code, 4, CASE WHEN n <= 5 THEN 50 ELSE 25 END)
    ON CONFLICT (building_id, code) DO NOTHING;
  END LOOP;

  -- ════════════════════════════════════════════════════════════════════
  -- WFz/IP Ingardena 6 — 2-3 cyfra. ~50 sal.
  -- ════════════════════════════════════════════════════════════════════
  FOR f IN 0..2 LOOP
    -- "Parter" używa 2-cyfra (12, 25, 78), wyższe 3-cyfra (201, 220)
    IF f = 0 THEN
      FOR n IN 10..40 LOOP
        room_code := n::TEXT;
        cap := CASE WHEN n IN (12, 13, 25) THEN 40 WHEN n IN (78, 100) THEN 80 ELSE 25 END;
        INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
        VALUES ('ingardena-6', room_code, 'Sala ' || room_code, 0, cap)
        ON CONFLICT (building_id, code) DO NOTHING;
      END LOOP;
    ELSE
      FOR n IN 1..15 LOOP
        room_code := (f * 100 + n + 30)::TEXT;  -- 131-145, 231-245
        cap := CASE WHEN n <= 3 THEN 60 WHEN n <= 8 THEN 40 ELSE 25 END;
        INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
        VALUES ('ingardena-6', room_code, 'Sala ' || room_code, f, cap)
        ON CONFLICT (building_id, code) DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;

  -- ════════════════════════════════════════════════════════════════════
  -- WH Gołębia 13 — 2-3 cyfra. ~30 sal.
  -- ════════════════════════════════════════════════════════════════════
  FOR n IN 10..30 LOOP
    room_code := n::TEXT;
    cap := CASE WHEN n IN (17, 25) THEN 40 ELSE 25 END;
    INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
    VALUES ('golebia-13', room_code, 'Sala ' || room_code, 0, cap)
    ON CONFLICT (building_id, code) DO NOTHING;
  END LOOP;
  FOR n IN 50..70 LOOP
    room_code := n::TEXT;
    cap := CASE WHEN n IN (56) THEN 50 ELSE 30 END;
    INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
    VALUES ('golebia-13', room_code, 'Sala ' || room_code, 1, cap)
    ON CONFLICT (building_id, code) DO NOTHING;
  END LOOP;
  FOR n IN 101..115 LOOP
    room_code := n::TEXT;
    INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
    VALUES ('golebia-13', room_code, 'Sala ' || room_code, 1, CASE WHEN n <= 105 THEN 50 ELSE 30 END)
    ON CONFLICT (building_id, code) DO NOTHING;
  END LOOP;

  -- ════════════════════════════════════════════════════════════════════
  -- WPol Gołębia 16 — 2-3 cyfra. ~30 sal.
  -- ════════════════════════════════════════════════════════════════════
  FOR n IN 10..30 LOOP
    room_code := n::TEXT;
    cap := CASE WHEN n IN (17, 23, 25) THEN 40 ELSE 25 END;
    INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
    VALUES ('golebia-16', room_code, 'Sala ' || room_code, 0, cap)
    ON CONFLICT (building_id, code) DO NOTHING;
  END LOOP;
  FOR n IN 40..70 LOOP
    room_code := n::TEXT;
    cap := CASE WHEN n IN (47, 53, 58) THEN 50 ELSE 30 END;
    INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
    VALUES ('golebia-16', room_code, 'Sala ' || room_code, 1, cap)
    ON CONFLICT (building_id, code) DO NOTHING;
  END LOOP;

  -- ════════════════════════════════════════════════════════════════════
  -- WPiA Bracka 12 — 2-3 cyfra + nazwane. ~40 sal.
  -- ════════════════════════════════════════════════════════════════════
  FOR n IN 10..50 LOOP
    room_code := n::TEXT;
    cap := CASE WHEN n IN (11, 23, 41) THEN 40 WHEN n IN (15, 35) THEN 60 ELSE 30 END;
    INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
    VALUES ('bracka-12', room_code, 'Sala ' || room_code, 0, cap)
    ON CONFLICT (building_id, code) DO NOTHING;
  END LOOP;
  FOR n IN 100..130 LOOP
    room_code := n::TEXT;
    cap := CASE WHEN n IN (101, 102, 110) THEN 60 WHEN n IN (115, 120) THEN 50 ELSE 35 END;
    INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
    VALUES ('bracka-12', room_code, 'Sala ' || room_code, 1, cap)
    ON CONFLICT (building_id, code) DO NOTHING;
  END LOOP;
  FOR n IN 200..220 LOOP
    room_code := n::TEXT;
    INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
    VALUES ('bracka-12', room_code, 'Sala ' || room_code, 2, CASE WHEN n <= 205 THEN 60 ELSE 35 END)
    ON CONFLICT (building_id, code) DO NOTHING;
  END LOOP;

  -- ════════════════════════════════════════════════════════════════════
  -- WSMiP Reymonta 4 — 2-3 cyfra. ~40 sal.
  -- ════════════════════════════════════════════════════════════════════
  FOR n IN 10..50 LOOP
    room_code := n::TEXT;
    cap := CASE WHEN n IN (17, 18, 19) THEN 60 WHEN n IN (23, 25) THEN 40 ELSE 30 END;
    INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
    VALUES ('reymonta-4', room_code, 'Sala ' || room_code, 0, cap)
    ON CONFLICT (building_id, code) DO NOTHING;
  END LOOP;
  FOR n IN 51..95 LOOP
    room_code := n::TEXT;
    cap := CASE WHEN n IN (55, 56) THEN 60 WHEN n IN (78, 88) THEN 50 ELSE 30 END;
    INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity)
    VALUES ('reymonta-4', room_code, 'Sala ' || room_code, 1, cap)
    ON CONFLICT (building_id, code) DO NOTHING;
  END LOOP;

  -- ════════════════════════════════════════════════════════════════════
  -- BJ Mickiewicza 22 — czytelnie + sale pracy zespołowej. ~15 sal.
  -- ════════════════════════════════════════════════════════════════════
  FOR n IN 1..10 LOOP
    room_code := 'SPZ-' || LPAD(n::TEXT, 2, '0');
    INSERT INTO public.uj_rooms (building_id, code, display_name, floor, capacity, notes)
    VALUES (
      'mickiewicza-22-bj', room_code, 'Sala pracy zespołowej ' || room_code,
      CASE WHEN n <= 5 THEN 1 ELSE 2 END,
      6,
      'Rezerwacja online — max 4h dziennie.'
    )
    ON CONFLICT (building_id, code) DO NOTHING;
  END LOOP;

END $$;

COMMIT;
