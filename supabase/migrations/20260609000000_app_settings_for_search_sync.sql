-- Dynamic webhook URL/secret via `public.app_settings` (zastępuje GUC z 20260608230000).
--
-- Supabase Cloud nie pozwala `ALTER DATABASE ... SET ...` z roli `postgres`
-- (managed Postgres odbiera SUPERUSER), więc poprzednie podejście oparte na
-- `current_setting('app.settings.*')` zostaje porzucone na rzecz zwykłej
-- tabeli konfiguracyjnej zamkniętej RLS-em. Funkcja triggera `SECURITY DEFINER`
-- czyta z niej, omijając RLS — żadne uprawnienia superusera nie są potrzebne.

-- ────────────────────────────────────────────────────────────────────────────
-- Konfiguracja per środowisko (uruchom RAZ z SQL Editor / `psql`):
--
--   INSERT INTO public.app_settings (key, value) VALUES
--     ('sync_webhook_url',    'https://<TWOJA-VERCEL-DOMENA>/api/sync-search'),
--     ('sync_webhook_secret', '<ten sam string co SECRET_WEBHOOK_KEY na Vercelu>')
--   ON CONFLICT (key) DO UPDATE
--     SET value = EXCLUDED.value, updated_at = now();
--
-- Brak wpisu ⇒ fallback do lokalnego dev (`host.docker.internal:3000`).
-- Pusty `value` w `sync_webhook_url` ⇒ sync wyłączony (no-op, brak HTTP).
-- ────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.app_settings (
    key        text PRIMARY KEY,
    value      text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Brak polityk = nikt z `anon`/`authenticated` nie ma dostępu z poziomu API.
-- Tabela jest czytana wyłącznie przez `http_sync_to_meilisearch()` z prawem
-- SECURITY DEFINER (właściciel = `postgres`), które omija RLS.
REVOKE ALL ON TABLE public.app_settings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.http_sync_to_meilisearch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    webhook_url    text;
    webhook_secret text;
    payload        jsonb;
BEGIN
    SELECT value INTO webhook_url
      FROM public.app_settings
     WHERE key = 'sync_webhook_url'
     LIMIT 1;

    SELECT value INTO webhook_secret
      FROM public.app_settings
     WHERE key = 'sync_webhook_secret'
     LIMIT 1;

    IF webhook_url IS NULL THEN
        webhook_url := 'http://host.docker.internal:3000/api/sync-search';
    END IF;

    IF webhook_secret IS NULL OR webhook_secret = '' THEN
        webhook_secret := 'ujverse_secret_2026';
    END IF;

    -- Eksplicytny opt-out: pusty URL = sync wyłączony, np. dla preview branches
    -- albo CI bez działającego endpointu.
    IF webhook_url = '' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    payload := jsonb_build_object(
        'type',       TG_OP,
        'table',      TG_TABLE_NAME,
        'schema',     TG_TABLE_SCHEMA,
        'record',     CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
        'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
    );

    PERFORM net.http_post(
        url     := webhook_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || webhook_secret
        ),
        body    := payload
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_post_change_sync          ON public.posts;
DROP TRIGGER IF EXISTS on_announcement_change_sync  ON public.announcements;
DROP TRIGGER IF EXISTS on_profile_change_sync       ON public.profiles;
DROP TRIGGER IF EXISTS posts_search_webhook         ON public.posts;
DROP TRIGGER IF EXISTS announcements_search_webhook ON public.announcements;
DROP TRIGGER IF EXISTS profiles_search_webhook      ON public.profiles;

CREATE TRIGGER on_post_change_sync
    AFTER INSERT OR UPDATE OR DELETE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.http_sync_to_meilisearch();

CREATE TRIGGER on_announcement_change_sync
    AFTER INSERT OR UPDATE OR DELETE ON public.announcements
    FOR EACH ROW EXECUTE FUNCTION public.http_sync_to_meilisearch();

CREATE TRIGGER on_profile_change_sync
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.http_sync_to_meilisearch();

COMMENT ON TABLE public.app_settings IS
    'Lekka key/value tabela dla konfiguracji runtime triggerów / funkcji. '
    'Zablokowana RLS — czytanie wyłącznie przez SECURITY DEFINER. '
    'Kanoniczne klucze: sync_webhook_url, sync_webhook_secret.';

COMMENT ON FUNCTION public.http_sync_to_meilisearch IS
    'Zunifikowany trigger sync do Meilisearch (posts/announcements/profiles). '
    'URL i sekret czytane z public.app_settings (sync_webhook_url / sync_webhook_secret). '
    'Fallback dev: host.docker.internal:3000 + ujverse_secret_2026. '
    'Pusty URL = sync wyłączony (no-op).';
