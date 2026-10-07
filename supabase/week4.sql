-- This is the SQL that was run in the Supabase SQL Editor for Week 4.
-- It is kept here as a record of the schema, triggers and security rules.

-- Week 4: photo posts, AI captions, and votes
-- Everything below runs in one transaction: if any statement fails, nothing changes.

-- ───────────────────────── Tables ─────────────────────────

-- A photo someone uploaded. The image file lives in Storage; this row keeps its path.
create table public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null,          -- filled in by a trigger from the author's profile
  image_path text not null unique,    -- file in the "photos" Storage bucket
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);

-- One AI-written caption for a post, in one of three voices.
-- `prompt` and `model` record exactly how it was generated.
create table public.captions (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  voice text not null check (voice in ('midwest_nice', 'nyc_local', 'chronically_online')),
  content text not null check (char_length(content) between 1 and 300),
  prompt text not null,
  model text not null,
  upvotes integer not null default 0,   -- kept up to date by a trigger on caption_votes
  downvotes integer not null default 0,
  created_at timestamptz not null default now(),
  unique (post_id, voice)
);

-- One row per (user, caption): +1 is an upvote, -1 is a downvote.
create table public.caption_votes (
  id bigint generated always as identity primary key,
  caption_id bigint not null references public.captions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (caption_id, user_id)
);

create index posts_created_at_idx on public.posts (created_at desc);
create index posts_user_id_idx on public.posts (user_id, created_at desc);
create index caption_votes_user_id_idx on public.caption_votes (user_id);

-- ───────────────────────── Triggers ─────────────────────────

-- Before a post is saved: stamp the author's first name from their profile
-- (so it cannot be faked) and enforce a daily limit that protects the AI quota.
create function public.prepare_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author text;
  recent integer;
begin
  select nullif(btrim(p.first_name), '') into author
  from public.profiles p where p.id = new.user_id;
  if author is null then
    raise exception 'Finish your profile before posting.';
  end if;

  select count(*) into recent
  from public.posts p
  where p.user_id = new.user_id and p.created_at > now() - interval '24 hours';
  if recent >= 10 then
    raise exception 'Daily limit reached: 10 posts per 24 hours.';
  end if;

  new.author_name := author;
  return new;
end;
$$;

create trigger posts_prepare
  before insert on public.posts
  for each row execute function public.prepare_post();

-- After any vote is added, changed or removed: keep the caption's counters in sync.
create function public.apply_caption_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.captions
    set upvotes = upvotes - (old.vote = 1)::int,
        downvotes = downvotes - (old.vote = -1)::int
    where id = old.caption_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.captions
    set upvotes = upvotes + (new.vote = 1)::int,
        downvotes = downvotes + (new.vote = -1)::int
    where id = new.caption_id;
  end if;
  return null;
end;
$$;

create trigger caption_votes_count
  after insert or update or delete on public.caption_votes
  for each row execute function public.apply_caption_vote();

-- Running totals per voice, for the scoreboard.
create function public.voice_scores()
returns table (voice text, upvotes bigint, downvotes bigint, caption_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.voice, sum(c.upvotes)::bigint, sum(c.downvotes)::bigint, count(*)::bigint
  from public.captions c
  group by c.voice;
$$;

-- ───────────────────────── Row Level Security ─────────────────────────

alter table public.posts enable row level security;
alter table public.captions enable row level security;
alter table public.caption_votes enable row level security;

-- posts: anyone can read; you can only add or delete your own, and the
-- image must sit in your own Storage folder.
create policy "Anyone can read posts"
  on public.posts for select to anon, authenticated
  using (true);

create policy "Users can create their own posts"
  on public.posts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (storage.foldername(image_path))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own posts"
  on public.posts for delete to authenticated
  using (user_id = (select auth.uid()));

-- captions: anyone can read; you can only attach captions to your own post.
-- There is no update or delete policy, so captions can never be edited.
create policy "Anyone can read captions"
  on public.captions for select to anon, authenticated
  using (true);

create policy "Users can add captions to their own posts"
  on public.captions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.user_id = (select auth.uid())
    )
  );

-- caption_votes: private. You can only see, cast, change or remove your own vote.
create policy "Users can read their own votes"
  on public.caption_votes for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can cast their own votes"
  on public.caption_votes for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can change their own votes"
  on public.caption_votes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can remove their own votes"
  on public.caption_votes for delete to authenticated
  using (user_id = (select auth.uid()));

-- ───────────────────────── Privileges ─────────────────────────
-- RLS decides WHICH ROWS; these grants decide WHICH COLUMNS and ACTIONS.
-- Start from nothing and grant only what the app uses.

revoke all on public.posts, public.captions, public.caption_votes from anon, authenticated;

grant select on public.posts, public.captions to anon, authenticated;

grant insert (image_path, note) on public.posts to authenticated;
grant delete on public.posts to authenticated;

-- upvotes / downvotes are not insertable: only the vote trigger changes them.
grant insert (post_id, voice, content, prompt, model) on public.captions to authenticated;

grant select, delete on public.caption_votes to authenticated;
grant insert (caption_id, vote) on public.caption_votes to authenticated;
grant update (vote) on public.caption_votes to authenticated;

-- Tighten the tables from earlier weeks to match.
revoke all on public.jokes from anon, authenticated;
grant select on public.jokes to anon, authenticated;

revoke all on public.profiles from anon;
revoke delete, truncate, references, trigger on public.profiles from authenticated;

-- Trigger functions are never called directly; the scoreboard is public.
revoke execute on function public.prepare_post() from public, anon, authenticated;
revoke execute on function public.apply_caption_vote() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.voice_scores() from public;
grant execute on function public.voice_scores() to anon, authenticated;

-- ───────────────────────── Storage ─────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Users can view their own photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their own photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- The auth service fires the signup trigger, so it keeps permission to run it.
grant execute on function public.handle_new_user() to supabase_auth_admin;
