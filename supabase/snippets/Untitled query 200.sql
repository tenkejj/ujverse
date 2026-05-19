-- Włączenie nadawania Realtime dla wybranych tabel
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;