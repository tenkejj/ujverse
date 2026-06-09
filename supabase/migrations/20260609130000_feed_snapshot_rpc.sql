-- Feed snapshot RPC — single-roundtrip paginated feed.
--
-- Zastępuje dotychczasowy 3-fazowy fetch w `src/App.tsx`:
--   1) posts + profiles join
--   2) likes (po listach id)
--   3) comments count (po listach id)
-- jednym wywołaniem `select get_feed_snapshot(p_limit, p_cursor_ts, p_cursor_id)`
-- które zwraca JSONB:
--   { "posts": [ { ...post, author: {...}, likes_count, comments_count, is_liked } ],
--     "next_cursor": { "created_at": ..., "id": ... } | null }
--
-- Paginacja: keyset po (created_at desc, id desc) — stabilna przy nowych postach
-- w trakcie scrollowania (OFFSET ślizga się przy INSERT na tail-end).
--
-- Bezpieczeństwo: `security invoker` — RLS na `posts` / `profiles` / `likes` /
-- `comments` działa standardowo. `viewer` jest brane z `auth.uid()` w środku
-- funkcji, nie z parametru — klient nie może podszyć się pod innego usera
-- dla flagi `is_liked`.

-- Defensywne casty `::text` na join'ach `likes.post_id` / `comments.post_id`
-- vs `posts.id`. Powód: w repo migracje definiują `post_id` jako bigint
-- (`20260401000000_base_bootstrap.sql`), ale deployed baza może mieć text /
-- uuid (rozjazd `supabase_setup.sql` vs migrations/, patrz
-- `.cursor/ARCHITECT_MAP.md` → Known drift). Cast na obu stronach gwarantuje
-- działanie niezależnie od typu; PostgREST i tak zwraca jednolicie.
create or replace function public.get_feed_snapshot(
  p_limit       int default 30,
  p_cursor_ts   timestamptz default null,
  p_cursor_id   bigint default null
) returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with viewer as (
    select auth.uid() as id
  ),
  page as (
    select p.*
    from public.posts p
    join public.profiles pr on pr.id = p.user_id
    where pr.is_banned is not true
      and (
        p_cursor_ts is null
        or p.created_at < p_cursor_ts
        or (
          p.created_at = p_cursor_ts
          and p.id < coalesce(p_cursor_id, 0)
        )
      )
    order by p.created_at desc, p.id desc
    limit greatest(1, least(coalesce(p_limit, 30), 50))
  ),
  enriched as (
    select
      page.*,
      coalesce(l.cnt, 0)::int        as likes_count,
      coalesce(c.cnt, 0)::int        as comments_count,
      coalesce(my.has_liked, false)  as is_liked,
      -- Alias `author_profile_json` (nie `author`), bo `page.*` może już
      -- zawierać kolumnę `author` w deployed `posts` (rozjazd vs migracje
      -- w repo). Duplikat nazw w SELECT robi 42702 — ambiguous column.
      jsonb_build_object(
        'id', pr_row.id,
        'full_name', pr_row.full_name,
        'username', pr_row.username,
        'avatar_url', pr_row.avatar_url,
        'department', pr_row.department,
        'is_banned', pr_row.is_banned,
        'show_department', pr_row.show_department,
        'role', pr_row.role
      ) as author_profile_json
    from page
    join public.profiles pr_row on pr_row.id = page.user_id
    left join lateral (
      select count(*)::int as cnt
      from public.likes l
      where l.post_id::text = page.id::text
    ) l on true
    left join lateral (
      select count(*)::int as cnt
      from public.comments c
      where c.post_id::text = page.id::text
    ) c on true
    left join lateral (
      select true as has_liked
      from public.likes l2, viewer v
      where l2.post_id::text = page.id::text
        and v.id is not null
        and l2.user_id = v.id
      limit 1
    ) my on true
  ),
  agg as (
    select
      jsonb_build_object(
        'id', e.id,
        'user_id', e.user_id,
        'content', e.content,
        'image_url', e.image_url,
        'tags', e.tags,
        'created_at', e.created_at,
        'likes_count', e.likes_count,
        'comments_count', e.comments_count,
        'is_liked', e.is_liked,
        'profiles', e.author_profile_json
      ) as post_json,
      e.created_at,
      e.id
    from enriched e
  ),
  last_row as (
    select created_at, id
    from agg
    order by created_at asc, id asc
    limit 1
  )
  select jsonb_build_object(
    'posts', coalesce((select jsonb_agg(post_json order by created_at desc, id desc) from agg), '[]'::jsonb),
    'next_cursor', case
      when (select count(*) from agg) < greatest(1, least(coalesce(p_limit, 30), 50))
        then null
      else (
        select jsonb_build_object('created_at', created_at, 'id', id)
        from last_row
      )
    end
  );
$$;

grant execute on function public.get_feed_snapshot(int, timestamptz, bigint) to authenticated;

-- Indeks pod keyset paginację (created_at desc, id desc). Bez niego Postgres
-- musi sortować całą tabelę przy każdej stronie.
create index if not exists posts_created_at_id_desc_idx
  on public.posts (created_at desc, id desc);

-- Wsparcie dla `count(*) where post_id = ?` w lateral subselect.
-- Mamy dwie wersje: na surowej kolumnie (działa gdy typy się zgadzają) i
-- expression-index na ::text (działa zawsze z cast'em z RPC powyżej).
-- `if not exists` zapewnia idempotencję — jeden z nich zostanie użyty
-- zależnie od faktycznego typu kolumny w deployed bazie.
create index if not exists likes_post_id_idx
  on public.likes (post_id);

create index if not exists comments_post_id_idx
  on public.comments (post_id);

create index if not exists likes_post_id_text_idx
  on public.likes ((post_id::text));

create index if not exists comments_post_id_text_idx
  on public.comments ((post_id::text));
