-- Utworzenie podstawowej tabeli profili studenckich
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    bio TEXT,
    department TEXT,
    role TEXT DEFAULT 'student',
    is_banned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Utworzenie podstawowej tabeli postów na tablicy
CREATE TABLE IF NOT EXISTS public.posts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT,
    body TEXT NOT NULL,
    department TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Utworzenie podstawowej tabeli komentarzy
CREATE TABLE IF NOT EXISTS public.comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Utworzenie podstawowej tabeli polubień postów
CREATE TABLE IF NOT EXISTS public.likes (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT likes_post_user_unique UNIQUE (post_id, user_id)
);

-- Utworzenie podstawowej tabeli polubień komentarzy
CREATE TABLE IF NOT EXISTS public.comment_likes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT REFERENCES public.comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT comment_likes_comment_user_unique UNIQUE (comment_id, user_id)
);

-- Utworzenie podstawowej tabeli odpowiedzi na komentarze (wymaganej przez Snapshot RPC)
CREATE TABLE IF NOT EXISTS public.comment_replies (
    id BIGSERIAL PRIMARY KEY,
    parent_comment_id BIGINT REFERENCES public.comments(id) ON DELETE CASCADE,
    reply_comment_id BIGINT REFERENCES public.comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT comment_replies_unique UNIQUE (parent_comment_id, reply_comment_id)
);

-- Włączenie RLS dla bezpieczeństwa
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_replies ENABLE ROW LEVEL SECURITY;