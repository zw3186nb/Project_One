-- Week 8: Three Takes' own prompt chains.
-- Run once in the SQL Editor of the Three Takes Supabase project (Michael Jordan).
-- Caption generation now reads its prompts from these tables instead of code,
-- and every run is logged. The admin area and the Prompt Chain Tool manage them.
-- It runs as one transaction: if anything fails, nothing changes.

begin;

-- ───────────── Models ─────────────
create table public.llm_providers (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug in ('groq', 'google')),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.llm_models (
  id bigint generated always as identity primary key,
  provider_id bigint not null references public.llm_providers (id) on delete restrict,
  name text not null,
  model_id text not null,                      -- the provider's own name for it
  supports_temperature boolean not null default true,
  supports_images boolean not null default false,
  created_at timestamptz not null default now(),
  unique (provider_id, model_id)
);

-- ───────────── Prompt chains ─────────────
create table public.prompt_chains (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text,
  is_active boolean not null default true,
  weight integer not null default 0 check (weight between 0 and 1000),  -- the mix: chance of being picked
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prompt_chain_steps (
  id bigint generated always as identity primary key,
  chain_id bigint not null references public.prompt_chains (id) on delete cascade,
  position integer not null,
  name text not null default '',
  kind text not null default 'general' check (kind in ('describe', 'write', 'general')),
  input text not null default 'text' check (input in ('image', 'text')),
  output text not null default 'text' check (output in ('text', 'json')),
  model_id bigint not null references public.llm_models (id) on delete restrict,
  temperature numeric check (temperature is null or temperature between 0 and 2),
  system_prompt text not null default '',
  user_prompt text not null default '',
  updated_at timestamptz not null default now()
);
create index prompt_chain_steps_chain_position on public.prompt_chain_steps (chain_id, position);

-- ───────────── What the prompts can draw on ─────────────
-- Terms: a slang dictionary of campus words the AI might not know.
create table public.terms (
  id bigint generated always as identity primary key,
  term text not null unique,
  definition text not null,
  example text not null default '',
  priority integer not null default 0,
  created_at timestamptz not null default now()
);

-- Examples: captions people found funny, fed back to the AI for tone.
create table public.generation_examples (
  id bigint generated always as identity primary key,
  caption text not null,
  image_description text not null default '',
  why_funny text not null default '',
  priority integer not null default 0,
  source_caption_id bigint references public.captions (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ───────────── Logs: every generation and every model call ─────────────
create table public.generation_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chain_id bigint references public.prompt_chains (id) on delete set null,
  post_id bigint references public.posts (id) on delete set null,
  image_path text,
  source text not null default 'app' check (source in ('app', 'admin', 'tool')),
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create table public.llm_responses (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.generation_requests (id) on delete cascade,
  step_id bigint references public.prompt_chain_steps (id) on delete set null,
  step_position integer,
  model_id bigint references public.llm_models (id) on delete set null,
  model_label text not null,
  system_prompt text not null,
  user_prompt text not null,
  response text not null,
  seconds numeric not null,
  created_at timestamptz not null default now()
);

-- Which chain and run produced each caption.
alter table public.captions
  add column chain_id bigint references public.prompt_chains (id) on delete set null,
  add column request_id bigint references public.generation_requests (id) on delete set null;

-- ───────────── Who may sign up ─────────────
create table public.allowed_signup_domains (
  id bigint generated always as identity primary key,
  domain text not null unique check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  created_at timestamptz not null default now()
);

create table public.whitelisted_emails (
  id bigint generated always as identity primary key,
  email text not null unique check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);

-- Open to everyone while both lists are empty; otherwise the e-mail's domain
-- must be listed (subdomains count) or the address whitelisted. Admins always pass.
create function public.signup_allowed(check_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (not exists (select 1 from public.allowed_signup_domains)
      and not exists (select 1 from public.whitelisted_emails))
    or exists (select 1 from public.whitelisted_emails w where lower(w.email) = lower(check_email))
    or exists (
      select 1 from public.allowed_signup_domains d
      where lower(split_part(check_email, '@', 2)) = d.domain
         or lower(split_part(check_email, '@', 2)) like '%.' || d.domain
    )
    or coalesce((select p.is_superadmin from public.profiles p where lower(p.email) = lower(check_email) limit 1), false);
$$;
revoke execute on function public.signup_allowed(text) from public, anon;
grant execute on function public.signup_allowed(text) to authenticated;

-- ───────────── Keep updated_at current ─────────────
create function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger prompt_chains_touch before update on public.prompt_chains
  for each row execute function public.touch_updated_at();
create trigger prompt_chain_steps_touch before update on public.prompt_chain_steps
  for each row execute function public.touch_updated_at();

-- ───────────── Security ─────────────
alter table public.llm_providers enable row level security;
alter table public.llm_models enable row level security;
alter table public.prompt_chains enable row level security;
alter table public.prompt_chain_steps enable row level security;
alter table public.terms enable row level security;
alter table public.generation_examples enable row level security;
alter table public.generation_requests enable row level security;
alter table public.llm_responses enable row level security;
alter table public.allowed_signup_domains enable row level security;
alter table public.whitelisted_emails enable row level security;

-- The generation settings: any signed-in user's post reads them; only admins change them.
do $$
declare t text;
begin
  foreach t in array array['llm_providers', 'llm_models', 'prompt_chains', 'prompt_chain_steps', 'terms', 'generation_examples'] loop
    execute format('create policy "Signed-in users can read %1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "Admins can add %1$s" on public.%1$I for insert to authenticated with check ((select public.is_superadmin()))', t);
    execute format('create policy "Admins can edit %1$s" on public.%1$I for update to authenticated using ((select public.is_superadmin())) with check ((select public.is_superadmin()))', t);
    execute format('create policy "Admins can delete %1$s" on public.%1$I for delete to authenticated using ((select public.is_superadmin()))', t);
  end loop;
  foreach t in array array['allowed_signup_domains', 'whitelisted_emails'] loop
    execute format('create policy "Admins manage %1$s" on public.%1$I for all to authenticated using ((select public.is_superadmin())) with check ((select public.is_superadmin()))', t);
  end loop;
end;
$$;

-- Logs: you write and read your own; admins read everything.
create policy "Users log their own generations" on public.generation_requests
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update their own generations" on public.generation_requests
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users and admins read generations" on public.generation_requests
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_superadmin()));
create policy "Admins delete generations" on public.generation_requests
  for delete to authenticated using ((select public.is_superadmin()));

create policy "Users log responses to their own generations" on public.llm_responses
  for insert to authenticated with check (
    exists (select 1 from public.generation_requests r where r.id = request_id and r.user_id = (select auth.uid()))
  );
create policy "Users and admins read responses" on public.llm_responses
  for select to authenticated using (
    (select public.is_superadmin())
    or exists (select 1 from public.generation_requests r where r.id = request_id and r.user_id = (select auth.uid()))
  );

revoke all on public.llm_providers, public.llm_models, public.prompt_chains, public.prompt_chain_steps,
  public.terms, public.generation_examples, public.generation_requests, public.llm_responses,
  public.allowed_signup_domains, public.whitelisted_emails from anon;
grant select, insert, update, delete on public.llm_providers, public.llm_models, public.prompt_chains,
  public.prompt_chain_steps, public.terms, public.generation_examples, public.generation_requests,
  public.llm_responses, public.allowed_signup_domains, public.whitelisted_emails to authenticated;
grant insert (chain_id, request_id) on public.captions to authenticated;

-- ───────────── Starting data ─────────────
insert into public.llm_providers (slug, name) values ('groq', 'Groq'), ('google', 'Google Gemini');

insert into public.llm_models (provider_id, name, model_id, supports_temperature, supports_images)
select p.id, m.name, m.model_id, true, true
from (values
  ('groq', 'Qwen 3.8 27B', 'qwen/qwen3.8-27b'),
  ('google', 'Gemini 3.5 Flash-Lite', 'gemini-3.5-flash-lite'),
  ('google', 'Gemini 3.8 Flash', 'gemini-3.8-flash')
) as m(provider, name, model_id)
join public.llm_providers p on p.slug = m.provider;

-- 1. The chain Three Takes has used since launch (one step), now with terms and examples.
insert into public.prompt_chains (slug, name, description, is_active, weight)
values ('classic', 'Three Takes classic',
  'One step: the model reads the photo and writes all three voices at once. The chain the app launched with.',
  true, 100);

-- 2. A two-step alternative: look first, then joke from the notes alone. Off in the mix (weight 0).
insert into public.prompt_chains (slug, name, description, is_active, weight)
values ('look-then-joke', 'Look, then joke',
  'Two steps: field notes about the photo, then the three voices written from the notes alone. Off by default (weight 0).',
  true, 0);

insert into public.prompt_chain_steps (chain_id, position, name, kind, input, output, model_id, temperature, system_prompt, user_prompt)
select c.id, s.position, s.name, s.kind, s.input, s.output, m.id, s.temperature, s.system_prompt, s.user_prompt
from (values
  ('classic', 1, 'Read the photo and write three takes', 'write', 'image', 'json', 1.0, $p$You are the comedy writer for Three Takes, a photo humor app for Columbia University undergrads in New York City. A student uploads a photo and you write three captions about it, each in a different voice. Students vote for the funniest one, so every caption has to earn a laugh.

STEP 1: READ THE PHOTO. Fill in these fields first.
- location: Where this is, as specifically as the photo supports. Use visible clues: signs, station names, architecture, logos, food, weather. Columbia and Morningside Heights places include Low Library and its steps, Butler Library, the Alma Mater statue, College Walk, John Jay and Ferris Booth dining halls, the 116th St-Columbia University station on the 1 train, Riverside Park, Broadway bodegas and the Hungarian Pastry Shop. If you are not sure, name a general place in 2 to 4 words, Title Case, no leading "a" or "the" ("Dorm Room", "Subway Car", "Photo Studio"). Keep it under 6 words: it is shown as a short label. Never claim a specific place you see no evidence for.
- scene: One sentence about who is in the photo and what is happening. Describe people only by what they are doing, wearing or holding. Never name or identify a real person, and never guess who someone is from their face.
- funniest_detail: The single most specific, absurd or relatable detail in the photo. The jokes are built on this.

STEP 2: WRITE THREE CAPTIONS about that place and detail.
1. midwest_nice: A sweet Midwesterner in their first year in New York. Comedy engine: relentless politeness and understatement in the face of chaos, plus comparisons to home (Target, Culver's, casseroles, "back in Ohio"). Sometimes says "ope" or "oh my gosh".
2. nyc_local: A jaded lifelong New Yorker. Comedy engine: deadpan one-upmanship, and cynicism about the MTA, rent and tourists. Nothing impresses them; they saw worse this morning.
3. chronically_online: A student who lives on TikTok and in group chats. Comedy engine: current internet formats such as "pov:", "the way...", "not the...", "it's giving...", "me when...", "nobody: / me:". All lowercase.

What makes a caption funny here:
- It is about THIS photo: it names or clearly points at the location or the funniest detail. A caption that would work on any photo is a failure.
- The punchline comes last, as a twist or an unexpected comparison.
- Specific nouns beat adjectives. Exaggerate one true thing.
- The three captions take three different angles, not the same joke three times.
- Never explain the joke. No hashtags. At most one emoji per caption. At most 140 characters per caption.
- Keep it PG-13 and kind: joke about the situation, never about anyone's body, race, gender, religion, disability or identity.

EXAMPLE, for a different photo (a dining hall tray with one lettuce leaf and four cookies):
{"location": "John Jay Dining Hall", "scene": "A tray on a dining hall table holds a single lettuce leaf next to four chocolate chip cookies.", "funniest_detail": "One lone lettuce leaf pretending to balance out four cookies", "midwest_nice": "Ope, look at that, a salad! Back home that's one more leaf than we'd put in a casserole.", "nyc_local": "One leaf of lettuce in this city is called a side salad and costs $14. Eat the cookies.", "chronically_online": "the lettuce is there so i can tell my mom i'm eating vegetables"}

Reply with JSON only, using exactly these keys: location, scene, funniest_detail, midwest_nice, nyc_local, chronically_online.$p$, $p$${note}

Campus words you may use if they fit (never force one in):
${terms}

Captions Three Takes students voted funniest before, for tone only (never copy them):
${examples}

Read the attached photo, then write the three captions.$p$),
  ('look-then-joke', 1, 'Field notes', 'describe', 'image', 'text', 0.3, $p$You are the eyes of a comedy writer who cannot see the photo. Write field notes, not jokes.

Cover, in short lines:
- location: where this is, as specifically as visible clues allow (signs, architecture, food, logos). Columbia and Morningside Heights places include Low Library and its steps, Butler Library, the Alma Mater statue, College Walk, John Jay and Ferris Booth dining halls, the 116th St station on the 1 train, Riverside Park and Broadway bodegas. If unsure, a general place in 2 to 4 words.
- scene: who is there and what is happening. Describe people only by what they do, wear or hold; never name or identify a real person.
- details: the 3 most specific, absurd or relatable details.
- mood: the emotion or energy of the photo.$p$, $p$${note}

Write the field notes for the attached photo.$p$),
  ('look-then-joke', 2, 'Three takes from the notes', 'write', 'text', 'json', 1.0, $p$You are the comedy writer for Three Takes, a photo humor app for Columbia University undergrads in New York City. You only get field notes about a photo, never the photo itself. Write three captions about it, each in a different voice.

1. midwest_nice: a sweet first-year Midwesterner in New York. Relentless politeness and understatement in the face of chaos, comparisons to home (Target, Culver's, casseroles, "back in Ohio"). Sometimes says "ope".
2. nyc_local: a jaded lifelong New Yorker. Deadpan one-upmanship, cynicism about the MTA, rent and tourists.
3. chronically_online: a student who lives on TikTok. Internet formats like "pov:", "the way...", "it's giving...", "me when...". All lowercase.

Every caption must point at the location or a specific detail from the notes, end on the punchline, stay under 140 characters, use at most one emoji, and stay PG-13 and kind (never joke about anyone's body, race, gender, religion, disability or identity).

Reply with JSON only, using exactly these keys: location, scene, funniest_detail, midwest_nice, nyc_local, chronically_online.$p$, $p$Field notes about the photo:
${step1Output}

${note}

Campus words you may use if they fit:
${terms}

Captions students voted funniest before, for tone only:
${examples}$p$)
) as s(chain, position, name, kind, input, output, temperature, system_prompt, user_prompt)
join public.prompt_chains c on c.slug = s.chain
join public.llm_models m on m.model_id = 'qwen/qwen3.8-27b';

insert into public.terms (term, definition, example, priority) values
  ('Butler', 'Butler Library, the main library; "living in Butler" means finals season', 'third night in Butler, the chairs know my name', 5),
  ('Low Steps', 'The steps of Low Library, where students sit, eat and people-watch', 'meet me on Low Steps at noon', 5),
  ('JJ''s', 'JJ''s Place, the late-night dining hall in John Jay Hall', 'JJ''s at 1am is a personality trait', 4),
  ('Ferris', 'Ferris Booth Commons, a dining hall in Lerner Hall', 'Ferris pasta again', 3),
  ('Lit Hum', 'Literature Humanities, the Core class where first-years read the classics', 'Lit Hum reading: 400 pages by Tuesday', 4),
  ('CC', 'Contemporary Civilization, the Core class on political and moral philosophy', 'arguing about Hobbes in CC at 9am', 3),
  ('Bacchanal', 'Columbia''s spring concert and party weekend', 'saving my energy for Bacchanal', 3),
  ('the 1', 'The 1 subway train, which stops at 116th St-Columbia University', 'the 1 is running local again, obviously', 4),
  ('ope', 'Midwestern sound for a small surprise or apology', 'ope, just gonna squeeze past ya', 2),
  ('it''s giving', 'Internet phrase: it has the energy or vibe of something', 'this dorm lighting is giving interrogation room', 2);

-- Seed the examples with today's three top-voted captions (more can be added in the admin area).
insert into public.generation_examples (caption, image_description, why_funny, priority, source_caption_id)
select c.content,
  coalesce(nullif(p.ai_scene, ''), p.ai_location, ''),
  'Students voted it up (net score ' || (c.upvotes - c.downvotes) || ').',
  5, c.id
from public.captions c
join public.posts p on p.id = c.post_id
where c.upvotes - c.downvotes > 0
order by c.upvotes - c.downvotes desc, c.upvotes desc
limit 3;

-- Existing captions came from the classic chain.
update public.captions set chain_id = (select id from public.prompt_chains where slug = 'classic')
where model not in ('written by admin', 'edited by admin');

commit;
