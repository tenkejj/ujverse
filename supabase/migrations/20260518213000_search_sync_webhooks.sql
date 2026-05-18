-- Search sync webhooks for Meilisearch index updates.
-- Replace <PROJECT_REF> and <SYNC_WEBHOOK_SECRET> before applying in target env.

drop trigger if exists posts_search_webhook on public.posts;
create trigger posts_search_webhook
after insert or update or delete on public.posts
for each row
execute function supabase_functions.http_request(
  'https://<PROJECT_REF>.supabase.co/functions/v1/sync-search',
  'POST',
  '{"Content-Type":"application/json","Authorization":"Bearer <SYNC_WEBHOOK_SECRET>"}',
  '{}',
  '5000'
);

drop trigger if exists announcements_search_webhook on public.announcements;
create trigger announcements_search_webhook
after insert or update or delete on public.announcements
for each row
execute function supabase_functions.http_request(
  'https://<PROJECT_REF>.supabase.co/functions/v1/sync-search',
  'POST',
  '{"Content-Type":"application/json","Authorization":"Bearer <SYNC_WEBHOOK_SECRET>"}',
  '{}',
  '5000'
);
