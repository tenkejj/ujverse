-- UJ Floor plans — rzuty pięter budynków UJ + room pinning na planie.
--
-- Idea: zamiast pokazywać szpilkę na generycznej mapie OSM, dla każdego
-- piętra mamy zgeoreferencjonowany obrazek (PNG/SVG) który Leaflet renderuje
-- jako `<ImageOverlay>` w bounds [(N,W),(S,E)]. Sala dostaje pin_x_pct /
-- pin_y_pct (procenty względem tego obrazka) — przeliczamy na lat/lng
-- in-place przy renderze.
--
-- Trade-offy:
--   * Bounds w lat/lng (a nie w pixelach obrazka) — pozwala zachować
--     spójność z resztą Leaflet stack'a (user marker, dystans haversine,
--     "Otwórz w Mapach" — wszystko to operuje na geo). Cost: każdy plan
--     trzeba zgeoreferencjonować raz (4 liczby zamiast jednej).
--   * `rotation_deg` opcjonalny — większość budynków UJ jest osiowo
--     orientowana, ale Collegium Novum / Wydz. Filolog. mają budynki
--     skręcone vs siatki ulic. ImageOverlay nie obsługuje rotation
--     natywnie; jeśli != 0 — UI obraca obrazek CSS-owo PRZED osadzeniem.
--   * `level` jako INT (a nie ENUM) — ujemne dla piwnic (-1, -2),
--     dodatnie dla pięter (0=parter, 1, 2, ...). Łatwo sortować w UI.
--   * Status `published` vs `pending` vs `crowdsourced` — flow gdzie user
--     wgra własny plan (CTA "Wgraj plan piętra") trafia jako
--     `crowdsourced` do moderacji, dopiero po review staje się
--     `published`. UI wyświetla tylko `published`.

-- ──────────────────────────────────────────────────────────────────────
-- 1. Tabela uj_building_floor_plans
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.uj_building_floor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id TEXT NOT NULL REFERENCES public.uj_buildings (id) ON DELETE CASCADE,
  -- 0 = parter, 1 = 1. piętro, -1 = piwnica, etc.
  level INT NOT NULL,
  display_name TEXT,
  image_url TEXT NOT NULL,
  -- Image dimensions (w pikselach) — pozwalają obliczyć aspect ratio
  -- placeholder'a zanim obrazek się załaduje i robić width-aware
  -- pin scaling.
  image_width_px INT,
  image_height_px INT,
  -- Georeferencja: dwa rogi prostokąta na mapie (top-left = NW,
  -- bottom-right = SE). Jeśli plan jest obrócony vs N/S/E/W —
  -- użyj rotation_deg (clockwise, positive).
  bounds_north NUMERIC(10, 7) NOT NULL,
  bounds_south NUMERIC(10, 7) NOT NULL,
  bounds_east  NUMERIC(10, 7) NOT NULL,
  bounds_west  NUMERIC(10, 7) NOT NULL,
  rotation_deg NUMERIC(5, 2) NOT NULL DEFAULT 0,
  -- Skąd plan pochodzi (URL źródła, nazwa pliku PDF, screenshot...).
  source_url TEXT,
  source_label TEXT,
  notes TEXT,
  -- 'published' = widoczne dla wszystkich;
  -- 'pending' = czeka na review (np. crowd-sourced);
  -- 'archived' = zastąpiony nowszym, nie pokazujemy.
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'pending', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (building_id, level, status)
);

CREATE INDEX IF NOT EXISTS uj_floor_plans_building_idx
  ON public.uj_building_floor_plans (building_id);

CREATE INDEX IF NOT EXISTS uj_floor_plans_published_idx
  ON public.uj_building_floor_plans (building_id, level)
  WHERE status = 'published';

-- ──────────────────────────────────────────────────────────────────────
-- 2. ALTER uj_rooms — pinning sali NA PLANIE (procenty)
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.uj_rooms
  ADD COLUMN IF NOT EXISTS pin_x_pct NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS pin_y_pct NUMERIC(5, 2);

-- pin_x/y są procentami (0–100) WZGLĘDEM rzutu piętra, tj. 0,0 = lewy
-- górny róg planu, 100,100 = prawy dolny. Zostawiamy NULL gdy nie znamy
-- precyzyjnej lokalizacji — UI fallback'uje na środek planu / pin
-- na lat/lng budynku.

ALTER TABLE public.uj_rooms
  DROP CONSTRAINT IF EXISTS uj_rooms_pin_x_range,
  DROP CONSTRAINT IF EXISTS uj_rooms_pin_y_range;

ALTER TABLE public.uj_rooms
  ADD CONSTRAINT uj_rooms_pin_x_range
    CHECK (pin_x_pct IS NULL OR (pin_x_pct >= 0 AND pin_x_pct <= 100)),
  ADD CONSTRAINT uj_rooms_pin_y_range
    CHECK (pin_y_pct IS NULL OR (pin_y_pct >= 0 AND pin_y_pct <= 100));

-- ──────────────────────────────────────────────────────────────────────
-- 3. Trigger updated_at
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_uj_floor_plans_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_uj_floor_plans_touch ON public.uj_building_floor_plans;
CREATE TRIGGER tg_uj_floor_plans_touch
  BEFORE UPDATE ON public.uj_building_floor_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_uj_floor_plans_touch_updated_at();

-- ──────────────────────────────────────────────────────────────────────
-- 4. RLS — public read tylko dla published, write service_role
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.uj_building_floor_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uj_floor_plans_select_published"
  ON public.uj_building_floor_plans FOR SELECT
  USING (status = 'published');

-- Brak policy dla INSERT/UPDATE/DELETE — efektywnie tylko service role
-- pisze (admin curated + crowd-sourced flow przez RPC w v2).

-- ──────────────────────────────────────────────────────────────────────
-- 5. Seed — stub rekordy dla budynków gdzie spodziewamy się że plan
--    będzie publicznie dostępny. NULL `image_url` byłby NOT NULL
--    constraint violation — używamy placeholdera (ścieżka public/
--    która zostanie wypełniona przez scripts/scrape-uj-floor-plans.ts
--    albo manual upload).
--
--    Bounds: dla seedu używam ±35m wokół centroidu budynku (proxy dla
--    typowego footprintu wydziałowego). Po pobraniu prawdziwego planu
--    georeferencjuje się ręcznie i UPDATE tych liczb.
--
--    Granice ±35m w lat: 1° lat ≈ 111 km → 35m ≈ 0.000315°
--    W lng (na szerokości 50°): 35m / cos(50°) ≈ 0.000490°
-- ──────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  bld RECORD;
  delta_lat NUMERIC := 0.000315;  -- ±35m N/S
  delta_lng NUMERIC := 0.000490;  -- ±35m E/W
BEGIN
  FOR bld IN
    SELECT id, lat, lng
    FROM public.uj_buildings
    WHERE id IN (
      'mickiewicza-22-bj',
      'auditorium-maximum',
      'bracka-12',
      'collegium-maius',
      'collegium-novum'
    )
  LOOP
    -- Status 'pending' = czekamy aż scraper / admin wgra prawdziwy
    -- obrazek. UI nie pokaże tego rekordu bo policy filtruje 'published'.
    INSERT INTO public.uj_building_floor_plans (
      building_id, level, display_name, image_url,
      bounds_north, bounds_south, bounds_east, bounds_west,
      source_label, status, notes
    ) VALUES (
      bld.id, 0, 'Parter',
      '/floor-plans/' || bld.id || '/0.png',
      bld.lat + delta_lat, bld.lat - delta_lat,
      bld.lng + delta_lng, bld.lng - delta_lng,
      'Stub — czeka na prawdziwy plan',
      'pending',
      'Stub seed; bounds ±35m wokół centroidu budynku. Zaktualizuj po wgraniu prawdziwego planu.'
    )
    ON CONFLICT (building_id, level, status) DO NOTHING;
  END LOOP;
END $$;
