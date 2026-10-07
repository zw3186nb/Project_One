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

export type GenerationResult =
  | { ok: true; captions: CaptionSet; prompt: string; model: string }
  | { ok: false; message: string };

const SYSTEM_PROMPT = `You write short, funny captions for photos posted by Columbia University undergrads living in New York City.

For the photo, write exactly three captions, one in each voice:

1. midwest_nice: A polite Midwesterner who just moved to New York. Relentlessly upbeat, understated, a little apologetic. Might say "ope" or "you betcha". Finds the bright side of everything, even when clearly rattled.
2. nyc_local: A jaded lifelong New Yorker. Deadpan and unimpressed. Has seen worse on the 1 train. Treats chaos as a normal Tuesday.
3. chronically_online: Someone who spends far too much time on the internet. Lowercase, meme-brained, self-aware, uses current internet slang.

Rules:
- Each caption is one or two sentences and at most 140 characters.
- Base the joke on what is actually visible in the photo. Be specific.
- Keep it PG-13 and kind. Joke about the situation, never about a person's body, race, gender, religion, disability or identity. Do not guess who anyone is.
- No hashtags. At most one emoji per caption.
- Reply with JSON only, in exactly this shape: {"midwest_nice": "...", "nyc_local": "...", "chronically_online": "..."}`;

function buildUserPrompt(note: string | null) {
  const context = note
    ? `The poster's note about the photo: "${note}"`
    : "The poster added no note.";
  return `${context}\n\nWrite the three captions for the attached photo.`;
}

/** Pulls the three captions out of the model's reply, tolerating code fences and stray text. */
function parseCaptions(text: string): CaptionSet | null {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const captions = {} as CaptionSet;
  for (const key of VOICE_KEYS) {
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value !== "string" || !value.trim()) return null;
    captions[key] = value.trim().slice(0, 300);
  }
  return captions;
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message?.slice(0, 200) ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

type Attempt = { captions: CaptionSet; model: string } | { error: string; retryable: boolean };

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
            properties: Object.fromEntries(VOICE_KEYS.map((key) => [key, { type: "STRING" }])),
            required: VOICE_KEYS,
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
  const captions = parseCaptions(text);
  if (!captions) {
    return { error: `Gemini (${model}) replied in an unexpected format.`, retryable: true };
  }
  return { captions, model };
}

async function askGroq(apiKey: string, model: string, userPrompt: string, image: InlineImage): Promise<Attempt> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 1,
      max_completion_tokens: 2048,
      response_format: { type: "json_object" },
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

  if (!response.ok) {
    return {
      error: `Groq (${model}) returned ${response.status}: ${await readError(response)}`,
      retryable: [404, 429, 500, 503].includes(response.status),
    };
  }

  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const captions = parseCaptions(body.choices?.[0]?.message?.content ?? "");
  if (!captions) {
    return { error: `Groq (${model}) replied in an unexpected format.`, retryable: true };
  }
  return { captions, model };
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
        return { ok: true, captions: result.captions, prompt, model: result.model };
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
