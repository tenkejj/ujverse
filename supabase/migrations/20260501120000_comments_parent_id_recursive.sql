-- Recursive comment threads on top of existing bigint comments.id
alter table public.comments
  add column if not exists parent_id bigint null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'comments_parent_id_fkey'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_parent_id_fkey
      foreign key (parent_id)
      references public.comments(id)
      on delete cascade;
  end if;
end $$;

create index if not exists comments_parent_id_idx on public.comments(parent_id);

alter table public.comments
  drop constraint if exists comments_parent_not_self;

alter table public.comments
  add constraint comments_parent_not_self
  check (parent_id is null or parent_id <> id);

alter table public.comments enable row level security;

drop policy if exists "Publiczne czytanie komentarzy" on public.comments;
create policy "Publiczne czytanie komentarzy"
  on public.comments
  for select
  using (true);

drop policy if exists "Zalogowani moga dodawac komentarze" on public.comments;
create policy "Zalogowani moga dodawac komentarze"
  on public.comments
  for insert
  with check (auth.uid() = user_id);
