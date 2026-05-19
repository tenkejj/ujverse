-- 1. Tworzymy profil Franka (jeśli go nie było)
INSERT INTO public.profiles (id, username, full_name, department, role, is_banned)
VALUES ('00000000-0000-0000-0000-000000000001', 'studenciak_uj', 'Franek z UJ', 'WZiKS', 'student', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Dodajemy post powiązany relacją
INSERT INTO public.posts (user_id, title, body, department)
VALUES ('00000000-0000-0000-0000-000000000001', 'Pytanie o sesję', 'Siemanko! Czy ktoś z WZiKS ma już materiały do nauki na egzamin z podstaw zarządzania?', 'WZiKS');