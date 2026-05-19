-- 1. Usuwamy stare triggery z tabeli POSTS
DROP TRIGGER IF EXISTS posts_search_webhook ON public.posts CASCADE;
DROP TRIGGER IF EXISTS on_post_change_sync ON public.posts CASCADE;

-- 2. Usuwamy stare triggery z tabeli PROFILES
DROP TRIGGER IF EXISTS profiles_search_webhook ON public.profiles CASCADE;
DROP TRIGGER IF EXISTS on_profile_change_sync ON public.profiles CASCADE;

-- 3. Usuwamy stare triggery z tabeli ANNOUNCEMENTS
DROP TRIGGER IF EXISTS announcements_search_webhook ON public.announcements CASCADE;
DROP TRIGGER IF EXISTS on_announcement_change_sync ON public.announcements CASCADE;

-- 4. Usuwamy potencjalne, starsze funkcje pomocnicze, które mogły to wywoływać
DROP FUNCTION IF EXISTS public.http_sync_to_meilisearch() CASCADE;
DROP FUNCTION IF EXISTS public.sync_posts_to_meilisearch() CASCADE;
DROP FUNCTION IF EXISTS public.sync_profiles_to_meilisearch() CASCADE;