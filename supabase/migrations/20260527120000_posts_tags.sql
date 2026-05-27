-- Smart Tags: denormalized hashtag array for posts (parsed from #tag in content).
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS posts_tags_gin_idx
  ON public.posts USING GIN (tags);
