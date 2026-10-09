-- Week 4 iteration (after PM feedback): what the AI saw in each photo,
-- and votes on the jokes list. Run once in the Supabase SQL Editor.

-- ───────────────────────── Posts: the AI's read of the photo ─────────────────────────

alter table public.posts
  add column ai_location text check (ai_location is null or char_length(ai_location) <= 120),
  add column ai_scene text check (ai_scene is null or char_length(ai_scene) <= 400);

grant insert (ai_location, ai_scene) on public.posts to authenticated;

-- ───────────────────────── Jokes: votes ─────────────────────────

alter table public.jokes
  add column upvotes integer not null default 0,   -- kept in sync by a trigger
  add column downvotes integer not null default 0;

-- One row per (user, joke): +1 is an upvote, -1 is a downvote.
create table public.joke_votes (
  id bigint generated always as identity primary key,
  joke_id bigint not null references public.jokes (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (joke_id, user_id)
);

create index joke_votes_user_id_idx on public.joke_votes (user_id);

create function public.apply_joke_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.jokes
    set upvotes = upvotes - (old.vote = 1)::int,
        downvotes = downvotes - (old.vote = -1)::int
    where id = old.joke_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.jokes
    set upvotes = upvotes + (new.vote = 1)::int,
        downvotes = downvotes + (new.vote = -1)::int
    where id = new.joke_id;
  end if;
  return null;
end;
$$;

create trigger joke_votes_count
  after insert or update or delete on public.joke_votes
  for each row execute function public.apply_joke_vote();

-- Private, like caption votes: you only ever see or touch your own vote.
alter table public.joke_votes enable row level security;

create policy "Users can read their own joke votes"
  on public.joke_votes for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can cast their own joke votes"
  on public.joke_votes for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can change their own joke votes"
  on public.joke_votes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can remove their own joke votes"
  on public.joke_votes for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.joke_votes from anon, authenticated;
grant select, delete on public.joke_votes to authenticated;
grant insert (joke_id, vote) on public.joke_votes to authenticated;
grant update (vote) on public.joke_votes to authenticated;

revoke execute on function public.apply_joke_vote() from public, anon, authenticated;
