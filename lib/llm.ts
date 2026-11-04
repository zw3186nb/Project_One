/*
 * Calls a language model for one prompt-chain step. Server-only: the API keys
 * (GROQ_API_KEY, GEMINI_API_KEY) are never sent to the browser.
 *
 * A step names a model from the llm_models table. If that model's provider has
 * no key configured here, the step runs on the other provider's default model
 * and the result says so, so a run never silently pretends.
 */

export type LlmImage = { base64: string; mimeType: string };
export type ProviderSlug = "groq" | "google";

export type LlmRequest = {
  provider: ProviderSlug;
  modelId: string;
  system: string;
  user: string;
  image?: LlmImage;
  temperature: number | null;
  json: boolean;
};

export type LlmResult =
  | { ok: true; text: string; provider: ProviderSlug; modelId: string; note: string | null }
  | { ok: false; message: string };

const DEFAULT_MODEL: Record<ProviderSlug, () => string> = {
  groq: () => process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
  google: () => process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
};
const KEY: Record<ProviderSlug, () => string | undefined> = {
  groq: () => process.env.GROQ_API_KEY,
  google: () => process.env.GEMINI_API_KEY,
};

/** Groq's free tier allows about 1,000 output tokens a minute for this model. */
const GROQ_MAX_OUTPUT_TOKENS = 450;

export function configuredProviders(): ProviderSlug[] {
  return (["groq", "google"] as const).filter((p) => KEY[p]());
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return (body.error?.message ?? response.statusText).replace(/ in organization `[^`]*`/g, "").slice(0, 300);
  } catch {
    return response.statusText;
  }
}

type Attempt = { text: string } | { status: number; error: string };

async function callGoogle(modelId: string, req: LlmRequest): Promise<Attempt> {
  const parts: unknown[] = [{ text: req.user }];
  if (req.image) parts.push({ inlineData: { mimeType: req.image.mimeType, data: req.image.base64 } });
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY.google()! },
    body: JSON.stringify({
      ...(req.system.trim() ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
      contents: [{ role: "user", parts }],
      generationConfig: {
        maxOutputTokens: 2048,
        ...(req.temperature == null ? {} : { temperature: req.temperature }),
        ...(req.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) return { status: response.status, error: await readError(response) };
  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    promptFeedback?: { blockReason?: string };
  };
  if (body.promptFeedback?.blockReason) return { status: 400, error: "The model declined this input. Try a different image." };
  const text = (body.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
    .trim();
  return text ? { text } : { status: 502, error: "The model returned an empty reply." };
}

async function callGroq(modelId: string, req: LlmRequest): Promise<Attempt> {
  const content = req.image
    ? [
        { type: "text", text: req.user },
        { type: "image_url", image_url: { url: `data:${req.image.mimeType};base64,${req.image.base64}` } },
      ]
    : req.user;
  const send = (extra: Record<string, unknown>) =>
    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY.groq()}` },
      body: JSON.stringify({
        model: modelId,
        max_completion_tokens: GROQ_MAX_OUTPUT_TOKENS,
        ...(req.temperature == null ? {} : { temperature: req.temperature }),
        ...(req.json ? { response_format: { type: "json_object" } } : {}),
        ...extra,
        messages: [...(req.system.trim() ? [{ role: "system", content: req.system }] : []), { role: "user", content }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
  // Skip the model's hidden "thinking": it would eat the small output budget.
  let response = await send({ reasoning_effort: "none", reasoning_format: "hidden" });
  if (response.status === 400) response = await send({});
  if (response.status === 429) {
    // Free-tier limit: wait as long as Groq asks (at most 20 s) and try once more.
    await sleep(Math.min(20, Number(response.headers.get("retry-after")) || 10) * 1000);
    response = await send({});
  }
  if (!response.ok) return { status: response.status, error: await readError(response) };
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = (body.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  return text ? { text } : { status: 502, error: "The model returned an empty reply." };
}

/** Runs one model call, falling back to the other provider when needed. */
export async function callModel(req: LlmRequest): Promise<LlmResult> {
  const available = configuredProviders();
  if (!available.length) {
    return { ok: false, message: "No AI key is configured. Add GROQ_API_KEY or GEMINI_API_KEY in Vercel, then redeploy." };
  }

  const plan: { provider: ProviderSlug; modelId: string; note: string | null }[] = [];
  if (available.includes(req.provider)) plan.push({ provider: req.provider, modelId: req.modelId, note: null });
  for (const other of available) {
    const modelId = DEFAULT_MODEL[other]();
    if (other === req.provider && modelId === req.modelId) continue;
    plan.push({
      provider: other,
      modelId,
      note: available.includes(req.provider)
        ? `${req.modelId} was unavailable, so this step ran on ${modelId}.`
        : `No ${req.provider === "google" ? "Gemini" : "Groq"} key is set, so this step ran on ${modelId}.`,
    });
  }

  let lastError = "The model call failed.";
  for (const attempt of plan) {
    try {
      const result = attempt.provider === "google" ? await callGoogle(attempt.modelId, req) : await callGroq(attempt.modelId, req);
      if ("text" in result) return { ok: true, text: result.text, provider: attempt.provider, modelId: attempt.modelId, note: attempt.note };
      lastError =
        result.status === 429
          ? `The AI is at its free-tier limit right now. Wait a minute and try again. (${result.error})`
          : `${attempt.modelId} returned ${result.status}: ${result.error}`;
      if (![404, 429, 500, 502, 503].includes(result.status)) break;
    } catch (e) {
      lastError = e instanceof Error && e.name === "TimeoutError" ? "The AI took too long to respond. Please try again." : "Could not reach the AI service. Please try again.";
    }
  }
  return { ok: false, message: lastError };
}
