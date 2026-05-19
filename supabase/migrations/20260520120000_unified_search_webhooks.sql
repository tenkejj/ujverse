-- Włączenie rozszerzenia do asynchronicznych żądań HTTP
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Funkcja wyzwalacza wysyłająca dane do Vercel API
CREATE OR REPLACE FUNCTION public.http_sync_to_meilisearch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    webhook_url text;
    webhook_secret text;
    payload jsonb;
BEGIN
    -- host.docker.internal pozwala kontenerowi Postgresa sięgnąć do Twojego komputera (gdzie działa vercel dev na porcie 3000)
    webhook_url := 'http://host.docker.internal:3000/api/sync-search';
    
    -- Wyciągamy sekret z konfiguracji (musi być taki sam jak SECRET_WEBHOOK_KEY w .env)
    webhook_secret := 'ujverse_secret_2026'; 

    -- Konstruowanie zunifikowanego payloadu dla operacji bazy danych
    payload := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'record', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
        'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
    );

    -- Wykonanie asynchronicznego i nieblokującego żądania HTTP POST
    PERFORM net.http_post(
        url := webhook_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || webhook_secret
        ),
        body := payload
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- 2. Czyszczenie starych lub nadmiarowych triggerów (zapobiegamy dublowaniu)
DROP TRIGGER IF EXISTS on_post_change_sync ON public.posts;
DROP TRIGGER IF EXISTS on_announcement_change_sync ON public.announcements;
DROP TRIGGER IF EXISTS on_profile_change_sync ON public.profiles;

-- 3. Podpięcie zunifikowanego triggera pod tabele systemu UJverse
CREATE TRIGGER on_post_change_sync
    AFTER INSERT OR UPDATE OR DELETE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.http_sync_to_meilisearch();

CREATE TRIGGER on_announcement_change_sync
    AFTER INSERT OR UPDATE OR DELETE ON public.announcements
    FOR EACH ROW EXECUTE FUNCTION public.http_sync_to_meilisearch();

CREATE TRIGGER on_profile_change_sync
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.http_sync_to_meilisearch();