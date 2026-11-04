# Three Takes

Post a photo from campus or the city. An AI captions it in three voices, and
everyone votes on which take wins.

Built week by week for *Designing for GenAI: The Humor Project* with Next.js,
Supabase and Vercel.

## Who it is for

**Sam** is a junior at Columbia College: chronically online, raised in the
Midwest, fairly new to New York, lives in the dorms and explores the city on
weekends. The three caption voices are the three sides of Sam:

| Voice | Sounds like |
| --- | --- |
| Midwest Nice | Polite, upbeat, quietly rattled |
| NYC Local | Deadpan; has seen worse on the 1 train |
| Chronically Online | lowercase, meme-brained, self-aware |

## Design decisions

- **A reason to come back daily.** Each weekday has its own photo prompt
  (Subway sightings, Dining hall crimes, Bodega finds…), and the voice
  scoreboard shifts as votes come in.
- **Becoming a source of content.** The feed is public and every post has its
  own shareable page (`/p/123`). Only posting and voting need an account.
- **Compared with a plain "upload and rate" app.** Each photo gets three
  labelled takes instead of one anonymous caption, so a vote also says
  *which kind of humor* landed. Voting happens in the feed with one click.
- **Transparent AI.** Every caption stores the exact prompt and model that
  produced it; each post has a "How these were written" section.

## Iteration log

- **Week 4 feedback (more funny, vote on jokes, shareable).** The AI first
  reads the photo (where, what's happening, the funniest detail), then writes
  three takes about that scene. Jokes can be voted on. Every post can be shared
  to WhatsApp, X, Facebook or as an Instagram story image, with link previews.
- **Week 5 (visual design, usability, "would I use this twice?").**
  - **Judge mode (`/play`)**: one photo at a time, tap the funniest take, then
    see how the crowd voted and whether you agreed. Only shows photos you
    haven't judged; keyboard shortcuts 1/2/3 and Enter.
  - **Judge first, then see results**: vote splits appear on a post only after
    you vote, so the crowd doesn't sway you.
  - **Clearer home page**: one main action ("Judge N new photos"), a three-step
    explainer for new visitors, top photographers leaderboard, sticky header
    with the current section highlighted.
  - **Profile**: your photos, how each is doing, and totals.
  - **Posting**: drag and drop, and a step-by-step progress list while the AI
    reads the photo and writes.
  - Photos of any shape sit on a blurred backdrop with a location label;
    loading skeletons; the intended font (Geist) is actually applied now.
- **Week 8 (prompt chains).** Captions now come from **prompt chains stored in
  the database** instead of a prompt in the code. Each upload picks an active
  chain by its mix weight, runs its steps in order, and logs every model call.
  Prompts can draw on a campus **terms** dictionary and on **examples** of
  captions students voted funniest. Admins manage all of it in the admin area
  and edit chains in the Prompt Chain Tool. Sign-ups can be limited to allowed
  e-mail domains or whitelisted addresses.

## How it works

1. The browser shrinks the photo and uploads it to Supabase Storage.
2. A server action picks a prompt chain (by its mix weight) and runs its steps:
   each step sends its prompts (and, if it needs it, the photo) to the AI model,
   and the last step returns the three captions. Every call is logged in
   `generation_requests` and `llm_responses`. If no chain is set up, the
   built-in prompt in `lib/ai.ts` is used.
3. The post and its captions are saved. The image itself is never stored in
   the database, only its path.
4. A vote inserts a row into `caption_votes`. A database trigger keeps each
   caption's up/down counters in sync.

### Tables

| Table | Holds | Who can do what (Row Level Security) |
| --- | --- | --- |
| `profiles` | name, photo path | only your own row |
| `posts` | photo path, note, author | anyone reads; you create/delete your own |
| `captions` | AI text, voice, prompt, model, counters | anyone reads; never editable |
| `caption_votes` | one vote per user per caption | only your own votes |
| `jokes` | week 2 sample data | read-only |
| `prompt_chains`, `prompt_chain_steps` | the generation recipes and their mix weights | everyone signed in reads; admins change |
| `llm_providers`, `llm_models` | which AI services and models steps can use | everyone signed in reads; admins change |
| `terms`, `generation_examples` | slang dictionary and example captions fed to the AI | everyone signed in reads; admins change |
| `generation_requests`, `llm_responses` | a log of every generation and model call | you write and read your own; admins read all |
| `allowed_signup_domains`, `whitelisted_emails` | who may sign up | admins only |

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public Supabase settings
- `GEMINI_API_KEY` **or** `GROQ_API_KEY`: server-only secret for the AI model
