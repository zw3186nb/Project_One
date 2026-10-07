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

## How it works

1. The browser shrinks the photo and uploads it to Supabase Storage.
2. A server action sends the photo and prompt to the AI model and gets three
   captions back.
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

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public Supabase settings
- `GEMINI_API_KEY` **or** `GROQ_API_KEY`: server-only secret for the AI model
