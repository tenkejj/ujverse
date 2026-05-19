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
    -- Używamy bezpośredniego IP bramy Dockera (172.17.0.1) zamiast host.docker.internal
    webhook_url := 'http://172.17.0.1:3000/api/sync-search';
    
    webhook_secret := 'ujverse_secret_2026'; 

    payload := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'record', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
        'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
    );

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