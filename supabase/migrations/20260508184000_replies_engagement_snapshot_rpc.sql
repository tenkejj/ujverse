create or replace function public.get_replies_engagement_snapshot(
  p_post_ids bigint[],
  p_reply_ids bigint[],
  p_viewer_id uuid default null
)
returns table (
  entity_type text,
  entity_id bigint,
  likes_count bigint,
  comments_count bigint,
  has_liked boolean
)
language sql
stable
as $$
  with post_target as (
    select distinct unnest(coalesce(p_post_ids, '{}'::bigint[])) as post_id
  ),
  reply_target as (
    select distinct unnest(coalesce(p_reply_ids, '{}'::bigint[])) as reply_id
  ),
  post_stats as (
    select
      'post'::text as entity_type,
      t.post_id as entity_id,
      coalesce((
        select count(*)
        from public.likes l
        where l.post_id = t.post_id
      ), 0)::bigint as likes_count,
      coalesce((
        select count(*)
        from public.comments c
        where c.post_id = t.post_id
      ), 0)::bigint as comments_count,
      coalesce((
        select exists(
          select 1
          from public.likes l2
          where l2.post_id = t.post_id
            and l2.user_id = p_viewer_id
        )
      ), false) as has_liked
    from post_target t
  ),
  reply_stats as (
    select
      'reply'::text as entity_type,
      t.reply_id as entity_id,
      coalesce((
        select count(*)
        from public.comment_likes cl
        where cl.comment_id = t.reply_id
      ), 0)::bigint as likes_count,
      coalesce((
        select count(*)
        from public.comment_replies cr
        where cr.parent_comment_id = t.reply_id
      ), 0)::bigint as comments_count,
      coalesce((
        select exists(
          select 1
          from public.comment_likes cl2
          where cl2.comment_id = t.reply_id
            and cl2.user_id = p_viewer_id
        )
      ), false) as has_liked
    from reply_target t
  )
  select entity_type, entity_id, likes_count, comments_count, has_liked
  from post_stats
  union all
  select entity_type, entity_id, likes_count, comments_count, has_liked
  from reply_stats;
$$;
