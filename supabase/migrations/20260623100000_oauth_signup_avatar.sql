-- Google OAuth gotowość: `handle_new_user` musi obsłużyć dwa równoległe światy:
--
--   1) Shadow-email (legacy, `username@ujverse.test`) — formularz w Login.tsx
--      mapuje login na shadow email; `username` NULL bo user już wpisał go
--      w UI (zachowujemy istniejący kontrakt z migracji 20260423100000).
--
--   2) OAuth (Google z @uj.edu.pl / @student.uj.edu.pl) — user nie ma okazji
--      wpisać username przed callbackiem, więc DERIVUJEMY go z local-part
--      maila (`jan.kowalski@student.uj.edu.pl` → `jan.kowalski`). Przy
--      kolizji dolepiamy sufiks numeryczny do 20 prób — potem fallback do
--      UUID prefiksu. UNIQUE constraint na `profiles.username` jest tu
--      bezpiecznikiem; do tego limit prób żeby trigger nie wisiał w pętli
--      gdy ktoś naburtwa Bazę.
--
-- Dodatkowo: zapisujemy `avatar_url` z metadata (Google ślę `picture`,
-- niektóre providery `avatar_url`). Wcześniejszy trigger to ignorował
-- i userzy musieli ręcznie wgrywać avatar — niepotrzebne tarcie przy
-- pierwszym logowaniu.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_local      TEXT;
  v_base_username    TEXT;
  v_candidate        TEXT;
  v_full_name        TEXT;
  v_avatar_url       TEXT;
  v_is_shadow_email  BOOLEAN;
  v_attempt          INT := 0;
BEGIN
  v_is_shadow_email := new.email ILIKE '%@ujverse.test';

  -- Local-part maila, ograniczony do bezpiecznego alfabetu username
  -- ([a-z0-9._-]). NULL-safe: pusty string → NULL żeby coalesce zadziałał.
  v_email_local := nullif(
    lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g')),
    ''
  );

  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    v_email_local,
    'Użytkownik UJverse'
  );

  v_avatar_url := nullif(
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ),
    ''
  );

  IF v_is_shadow_email THEN
    -- Legacy shadow path: zachowuje istniejący kontrakt (username NULL),
    -- bo Login.tsx zna nazwę i sam ją wpisał w trakcie shadow signup.
    INSERT INTO public.profiles (id, full_name, username, avatar_url)
    VALUES (new.id, v_full_name, NULL, v_avatar_url)
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
  END IF;

  -- OAuth path: derive unikatowy username.
  v_base_username := coalesce(v_email_local, 'user_' || substring(new.id::text, 1, 8));
  v_candidate := v_base_username;

  WHILE v_attempt < 20 AND EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_candidate)
  ) LOOP
    v_attempt := v_attempt + 1;
    v_candidate := v_base_username || v_attempt::text;
  END LOOP;

  -- Twardy fallback: gdy 20 prób się nie udało (mało prawdopodobne ale
  -- możliwe przy złośliwym seedzie), stawiamy NULL — user dostanie
  -- prompt w UI do wybrania samodzielnego.
  IF v_attempt = 20 AND EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_candidate)
  ) THEN
    v_candidate := NULL;
  END IF;

  INSERT INTO public.profiles (id, full_name, username, avatar_url)
  VALUES (new.id, v_full_name, v_candidate, v_avatar_url)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'AFTER INSERT na auth.users. Obsługuje shadow-email (@ujverse.test → username NULL) i OAuth (auto-derive username z emaila + avatar_url z user_metadata.picture/avatar_url).';

-- Idempotentny rebind triggera — wzór z migracji 20260423100000.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
