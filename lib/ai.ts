import { VOICE_KEYS, type VoiceKey } from "@/lib/voices";

/**
 * Asks an AI model to caption a photo in three voices.
 *
 * Works with either provider, depending on which secret is configured:
 *   GEMINI_API_KEY  -> Google Gemini
 *   GROQ_API_KEY    -> Groq
 * These are server-only secrets (no NEXT_PUBLIC_ prefix), so they are never
 * sent to the browser. This file is only ever imported by server code.
 */

export type CaptionSet = Record<VoiceKey, string>;

/** What the AI saw in the photo before writing the jokes. */
export type SceneReading = { location: string; scene: string; funniestDetail: string };

export type GenerationResult =
  | { ok: true; captions: CaptionSet; reading: SceneReading; prompt: string; model: string }
  | { ok: false; message: string };

const SYSTEM_PROMPT = `You are the comedy writer for Three Takes, a photo humor app for Columbia University undergrads in New York City. A student uploads a photo and you write three captions about it, each in a different voice. Students vote for the funniest one, so every caption has to earn a laugh.

STEP 1: READ THE PHOTO. Fill in these fields first.
- location: Where this is, as specifically as the photo supports. Use visible clues: signs, station names, architecture, logos, food, weather. Columbia and Morningside Heights places include Low Library and its steps, Butler Library, the Alma Mater statue, College Walk, John Jay and Ferris Booth dining halls, the 116th St-Columbia University station on the 1 train, Riverside Park, Broadway bodegas and the Hungarian Pastry Shop. If you are not sure, name a general place ("a dorm room", "a subway car"). Never claim a specific place you see no evidence for.
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

Reply with JSON only, using exactly these keys: location, scene, funniest_detail, midwest_nice, nyc_local, chronically_online.`;

function buildUserPrompt(note: string | null) {
  const context = note
    ? `The poster's note about the photo: "${note}"`
    : "The poster added no note.";
  return `${context}\n\nRead the attached photo, then write the three captions.`;
}

const OUTPUT_KEYS = ["location", "scene", "funniest_detail", ...VOICE_KEYS];

type Parsed = { captions: CaptionSet; reading: SceneReading };

/** Pulls the scene reading and the three captions out of the model's reply. */
function parseReply(text: string): Parsed | null {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const field = (key: string, max: number) => {
    const value = parsed[key];
    return typeof value === "string" ? value.trim().slice(0, max) : "";
  };

  const captions = {} as CaptionSet;
  for (const key of VOICE_KEYS) {
    const caption = field(key, 300);
    if (!caption) return null;
    captions[key] = caption;
  }

  return {
    captions,
    reading: {
      location: field("location", 120),
      scene: field("scene", 250),
      funniestDetail: field("funniest_detail", 140),
    },
  };
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    // Drop the account identifier some providers include, then keep it short.
    const message = body.error?.message?.replace(/ in organization `[^`]*`/g, "");
    return message?.slice(0, 300) ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

type Attempt = (Parsed & { model: string }) | { error: string; retryable: boolean };

async function askGemini(apiKey: string, model: string, userPrompt: string, image: InlineImage): Promise<Attempt> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              { text: userPrompt },
              { inlineData: { mimeType: image.mimeType, data: image.base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: Object.fromEntries(OUTPUT_KEYS.map((key) => [key, { type: "STRING" }])),
            required: OUTPUT_KEYS,
            propertyOrdering: OUTPUT_KEYS, // read the photo first, then write the jokes
          },
        },
      }),
      signal: AbortSignal.timeout(40_000),
    },
  );

  if (!response.ok) {
    return {
      error: `Gemini (${model}) returned ${response.status}: ${await readError(response)}`,
      retryable: [404, 429, 500, 503].includes(response.status),
    };
  }

  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };

  if (body.promptFeedback?.blockReason) {
    return { error: "The AI declined to caption this photo. Try a different one.", retryable: false };
  }

  const text = (body.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
  const parsed = parseReply(text);
  if (!parsed) {
    return { error: `Gemini (${model}) replied in an unexpected format.`, retryable: true };
  }
  return { ...parsed, model };
}

/**
 * Groq's free tier allows 1,000 output tokens per minute for this model, and
 * rejects any request whose reply limit is above that. The scene reading plus
 * three short captions need about 250 tokens; 450 leaves headroom and still
 * allows two posts a minute.
 */
const GROQ_MAX_OUTPUT_TOKENS = 450;

async function askGroq(apiKey: string, model: string, userPrompt: string, image: InlineImage): Promise<Attempt> {
  const send = (extra: Record<string, string>) =>
    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 1,
        max_completion_tokens: GROQ_MAX_OUTPUT_TOKENS,
        response_format: { type: "json_object" },
        ...extra,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(40_000),
    });

  // Skip the model's "thinking" step: captions do not need it, and thinking
  // would eat the small output budget. If a model rejects these options,
  // ask again without them.
  let response = await send({ reasoning_effort: "none", reasoning_format: "hidden" });
  if (response.status === 400) response = await send({});

  if (!response.ok) {
    const detail = await readError(response);
    return {
      error:
        response.status === 429
          ? `The AI is at its free-tier limit right now. Wait a minute and try again. (${detail})`
          : `Groq (${model}) returned ${response.status}: ${detail}`,
      retryable: [404, 500, 503].includes(response.status),
    };
  }

  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const parsed = parseReply(body.choices?.[0]?.message?.content ?? "");
  if (!parsed) {
    return { error: `Groq (${model}) replied in an unexpected format.`, retryable: true };
  }
  return { ...parsed, model };
}

type InlineImage = { base64: string; mimeType: string };

export async function generateCaptions(image: InlineImage, note: string | null): Promise<GenerationResult> {
  const userPrompt = buildUserPrompt(note);
  // Saved with every caption, so we always know exactly how it was produced.
  const prompt = `[system]\n${SYSTEM_PROMPT}\n\n[user]\n${userPrompt}\n\n[attachment]\nThe uploaded photo (${image.mimeType}).`;

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!geminiKey && !groqKey) {
    return {
      ok: false,
      message: "No AI key is configured. Add GEMINI_API_KEY or GROQ_API_KEY in Vercel, then redeploy.",
    };
  }

  // Try the preferred model first, then a fallback if it is missing or busy.
  const attempts: (() => Promise<Attempt>)[] = [];
  if (geminiKey) {
    const models = [process.env.GEMINI_MODEL, "gemini-3.5-flash-lite", "gemini-3.8-flash"];
    for (const model of [...new Set(models.filter(Boolean) as string[])]) {
      attempts.push(() => askGemini(geminiKey, model, userPrompt, image));
    }
  }
  if (groqKey) {
    const model = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
    attempts.push(() => askGroq(groqKey, model, userPrompt, image));
  }

  let lastError = "The AI did not respond.";
  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if ("captions" in result) {
        return { ok: true, captions: result.captions, reading: result.reading, prompt, model: result.model };
      }
      lastError = result.error;
      if (!result.retryable) break;
    } catch (e) {
      lastError =
        e instanceof Error && e.name === "TimeoutError"
          ? "The AI took too long to respond. Please try again."
          : "Could not reach the AI service. Please try again.";
    }
  }
  return { ok: false, message: lastError };
}
