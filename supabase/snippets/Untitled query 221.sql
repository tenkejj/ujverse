-- 1. Całkowicie czyścimy starą publikację, jeśli miała błędy
DROP PUBLICATION IF EXISTS supabase_realtime;

-- 2. Tworzymy nową, świeżą publikację dla systemu Realtime
CREATE PUBLICATION supabase_realtime;

-- 3. Jawnie dodajemy nasze tabele do publikacji
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- 4. Upewniamy się, że Postgres wysyła pełny rekord (wymagane do poprawnego parsowania JSON)
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;