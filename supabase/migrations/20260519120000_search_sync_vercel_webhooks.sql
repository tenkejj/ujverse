-- Search sync webhooks routed to Vercel `api/sync-search`.
-- Replace <VERCEL_DOMAIN> and <SECRET_WEBHOOK_KEY> before applying.

drop trigger if exists posts_search_webhook on public.posts;
create trigger posts_search_webhook
after insert or update or delete on public.posts
for each row
execute function supabase_functions.http_request(
  'https://<VERCEL_DOMAIN>/api/sync-search',
  'POST',
  '{"Content-Type":"application/json","Authorization":"Bearer <SECRET_WEBHOOK_KEY>"}',
  '{}',
  '5000'
);

drop trigger if exists announcements_search_webhook on public.announcements;
create trigger announcements_search_webhook
after insert or update or delete on public.announcements
for each row
execute function supabase_functions.http_request(
  'https://<VERCEL_DOMAIN>/api/sync-search',
  'POST',
  '{"Content-Type":"application/json","Authorization":"Bearer <SECRET_WEBHOOK_KEY>"}',
  '{}',
  '5000'
);

drop trigger if exists profiles_search_webhook on public.profiles;
create trigger profiles_search_webhook
after insert or update or delete on public.profiles
for each row
execute function supabase_functions.http_request(
  'https://<VERCEL_DOMAIN>/api/sync-search',
  'POST',
  '{"Content-Type":"application/json","Authorization":"Bearer <SECRET_WEBHOOK_KEY>"}',
  '{}',
  '5000'
);
