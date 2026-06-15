-- ============================================================================
-- UJverse – cleanup śmieciowych komunikatów z poprzednich runów scrapera
-- ============================================================================
-- Migracja 20260715120000 dodała 16-source scraper, który początkowo łapał:
--   • paginację Liferaya jako "Strona 140" / "Strona 1" / itp.
--   • widget DJ-Extensions Web Accessibility (CM wydziały) jako body
--     składające się z "Ułatwienia dostępu / Odwróć kolory / ...".
--   • menu nawigacji / footer (Struktura → Instytut..., Facebook / Twitter
--     / Youtube) jako body krótkich list bez interpunkcji.
--   • fallback `FALLBACK_LECTURER_NAME = 'Komunikat wydziałowy'` jako tytuł
--     (= sygnał że parser nie złapał prawdziwego tytułu artykułu).
--
-- Po migracji 20260715140000 parsery (`liferayParser.ts`, `wordpressCmParser.ts`)
-- filtrują te przypadki przed upsertem (`isHeadlineJunk`, `isBodyJunk`,
-- `stripChromeFromDom`). Tutaj usuwamy historyczne rekordy które już
-- zostały zapisane przed wdrożeniem filtra.
--
-- Bezpiecznie idempotentne — kasuje TYLKO rekordy pasujące do junk patternów.
-- Realne komunikaty z prawdziwymi tytułami nie są ruszane.
-- ============================================================================

-- 1. Junk titles (paginacja, sekcje menu, fallback names, social linki).
DELETE FROM public.announcements
WHERE title IS NOT NULL
  AND (
    title ~* '^strona\s+\d+$'
    OR title ~* '^komunikat(y)?\s+wydziałow(y|e)$'
    OR title ~* '^(aktualności|wiadomości|komunikaty|ogłoszenia)$'
    OR title ~* '^(struktura|pracownicy|studia|kontakt)$'
    OR title ~* '^zobacz\s+również$'
    OR title ~* '^nasze\s+działania$'
    OR title ~* '^przewodnik\s+jakościowy$'
    OR title ~* '^jakość\s+kształcenia(\s+na\s+uj)?$'
    OR title ~* '^(facebook|twitter|youtube|instagram|linkedin|tiktok|x)$'
    OR title ~* '^sprawy\s+studentów$'
    OR title ~* '^wydział\s+\S+$'
  );

-- 2. Junk bodies (widget dostępności + footer social linki) — tytuł może
-- być sensowny ale body zawiera 3+ tokens nawigacyjnych.
DELETE FROM public.announcements
WHERE body IS NOT NULL
  AND (
    -- Widget DJ-Extensions (≥2 oznaki = widget)
    (
      (CASE WHEN body ILIKE '%ułatwienia dostępu%' THEN 1 ELSE 0 END)
      + (CASE WHEN body ILIKE '%odwróć kolory%' THEN 1 ELSE 0 END)
      + (CASE WHEN body ILIKE '%monochromatyczny%' THEN 1 ELSE 0 END)
      + (CASE WHEN body ILIKE '%ciemny kontrast%' THEN 1 ELSE 0 END)
      + (CASE WHEN body ILIKE '%jasny kontrast%' THEN 1 ELSE 0 END)
      + (CASE WHEN body ILIKE '%niskie nasycenie%' THEN 1 ELSE 0 END)
      + (CASE WHEN body ILIKE '%wysokie nasycenie%' THEN 1 ELSE 0 END)
    ) >= 2
    -- Social-only footer (≥3 social linki, krótkie body)
    OR (
      length(body) < 250
      AND (
        (CASE WHEN body ILIKE '%facebook%' THEN 1 ELSE 0 END)
        + (CASE WHEN body ILIKE '%twitter%' THEN 1 ELSE 0 END)
        + (CASE WHEN body ILIKE '%youtube%' THEN 1 ELSE 0 END)
        + (CASE WHEN body ILIKE '%instagram%' THEN 1 ELSE 0 END)
        + (CASE WHEN body ILIKE '%odwiedź nasze media%' THEN 1 ELSE 0 END)
      ) >= 3
    )
  );

-- 3. Lecturer = 'Komunikat wydziałowy' (FALLBACK) + body bardzo krótki +
-- brak title — to oznaka że parser ABSOLUTNIE nic sensownego nie złapał.
-- (Realne komunikaty z fallback lecturer ale dłuższym body zostają.)
DELETE FROM public.announcements
WHERE lecturer_name = 'Komunikat wydziałowy'
  AND title IS NULL
  AND length(coalesce(body, '')) < 80;
