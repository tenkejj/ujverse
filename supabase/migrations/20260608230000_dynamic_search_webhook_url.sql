-- Dynamic webhook URL/secret for Meilisearch sync trigger.
--
-- Zastępuje hardcoded `http://host.docker.internal:3000/api/sync-search`
-- z migracji 20260520120000 wartościami z PostgreSQL GUC (`current_setting`),
-- dzięki czemu ta sama funkcja działa lokalnie i w Supabase Cloud +
-- produkcyjnym Vercelu, bez kolejnej migracji per środowisko.
--
-- ────────────────────────────────────────────────────────────────────────────
-- Konfiguracja per środowisko (uruchom RAZ na cluster, jako superuser):
--
--   ALTER DATABASE postgres SET app.settings.sync_webhook_url =
--     'https://<TWOJ-VERCEL-DOMENA>/api/sync-search';
--   ALTER DATABASE postgres SET app.settings.sync_webhook_secret =
--     '<SAME-AS-SECRET_WEBHOOK_KEY-na-Vercelu>';
--
-- Po zmianie ustawień każda nowa sesja Postgresa (w tym pg_net workers
-- spawned przez triggery) zacznie je widzieć. Istniejące długo żyjące
-- połączenia mogą wymagać `SELECT pg_reload_conf()` lub restartu.
--
-- Brak ustawień ⇒ fallback do lokalnego dev (`vercel dev` na porcie 3000
-- pod `host.docker.internal`), nadal z dev-secretem `ujverse_secret_2026`.
-- Ustawienie URL na pusty string ⇒ sync wyłączony (no-op, brak HTTP).
-- ────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net;

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
    webhook_url    := current_setting('app.settings.sync_webhook_url', true);
    webhook_secret := current_setting('app.settings.sync_webhook_secret', true);

    IF webhook_url IS NULL THEN
        webhook_url := 'http://host.docker.internal:3000/api/sync-search';
    END IF;

    IF webhook_secret IS NULL OR webhook_secret = '' THEN
        webhook_secret := 'ujverse_secret_2026';
    END IF;

    -- Eksplicytny opt-out: pusty URL = sync wyłączony, np. dla środowisk
    -- testowych/CI bez działającego endpointu — zwracamy NEW/OLD, ale nie
    -- robimy HTTP.
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

-- Re-create triggerów idempotentnie — żeby było jasne, do której funkcji
-- konkretnie są podpięte po wszystkich poprzednich migracjach search-sync.
DROP TRIGGER IF EXISTS on_post_change_sync          ON public.posts;
DROP TRIGGER IF EXISTS on_announcement_change_sync  ON public.announcements;
DROP TRIGGER IF EXISTS on_profile_change_sync       ON public.profiles;

-- Sprzątamy też reliktowe triggery z migracji 20260518213000 /
-- 20260519120000 (jeśli kiedyś trafiły do bazy), żeby nie strzelać
-- dwóch webhooków per zmiana wiersza.
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

COMMENT ON FUNCTION public.http_sync_to_meilisearch IS
    'Zunifikowany trigger sync do Meilisearch (posts/announcements/profiles). '
    'URL i sekret czytane z GUC: app.settings.sync_webhook_url / .sync_webhook_secret. '
    'Fallback dev: host.docker.internal:3000 + ujverse_secret_2026. '
    'Pusty URL = sync wyłączony (no-op).';
