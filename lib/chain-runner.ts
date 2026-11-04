import type { SupabaseClient } from "@supabase/supabase-js";
import { callModel, type LlmImage, type ProviderSlug } from "@/lib/llm";

/*
 * Runs a Three Takes prompt chain: the ordered steps in prompt_chain_steps,
 * each a model call whose prompts may use ${variables}. Every run is logged
 * in generation_requests, and every step's call in llm_responses.
 *
 * The same file is used by Three Takes, the admin area and the Prompt Chain
 * Tool, always with the signed-in user's Supabase client.
 */

export type Chain = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  weight: number;
  created_at: string;
  updated_at: string;
};

export type Step = {
  id: number;
  chain_id: number;
  position: number;
  name: string;
  kind: "describe" | "write" | "general";
  input: "image" | "text";
  output: "text" | "json";
  model_id: number;
  temperature: number | null;
  system_prompt: string;
  user_prompt: string;
  updated_at: string;
};

type ModelInfo = { id: number; name: string; model_id: string; supports_temperature: boolean; llm_providers: { slug: ProviderSlug } | { slug: ProviderSlug }[] | null };

export const CHAIN_COLUMNS = "id, slug, name, description, is_active, weight, created_at, updated_at";
export const STEP_COLUMNS = "id, chain_id, position, name, kind, input, output, model_id, temperature, system_prompt, user_prompt, updated_at";

/** The ${variables} a prompt can use. */
export const VARIABLES: { name: string; meaning: string }[] = [
  { name: "note", meaning: "the poster's note about the photo (or \"The poster added no note.\")" },
  { name: "step1Output", meaning: "what step 1 returned (also step2Output, step3Output, …)" },
  { name: "terms", meaning: "the Terms dictionary: campus words and what they mean" },
  { name: "examples", meaning: "Generation examples: captions students found funny" },
];

/** The keys the last step must return, as JSON, for Three Takes to save captions. */
export const FINAL_KEYS = ["location", "scene", "funniest_detail", "midwest_nice", "nyc_local", "chronically_online"] as const;
export const VOICE_KEYS = ["midwest_nice", "nyc_local", "chronically_online"] as const;
export type Voice = (typeof VOICE_KEYS)[number];

export type ThreeTakes = {
  captions: Record<Voice, string>;
  reading: { location: string; scene: string; funniestDetail: string };
};

/** Pulls the scene reading and the three captions out of the last step's reply. */
export function parseThreeTakes(text: string): ThreeTakes | null {
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
  if (!parsed || typeof parsed !== "object") return null;
  const field = (key: string, max: number) => (typeof parsed[key] === "string" ? (parsed[key] as string).trim().slice(0, max) : "");
  const captions = {} as Record<Voice, string>;
  for (const voice of VOICE_KEYS) {
    const caption = field(voice, 300);
    if (!caption) return null;
    captions[voice] = caption;
  }
  return { captions, reading: { location: field("location", 120), scene: field("scene", 400), funniestDetail: field("funniest_detail", 140) } };
}

/** Replaces ${name} with its value; reports names it could not fill. */
export function fillPrompt(template: string, values: Record<string, string>) {
  const missing = new Set<string>();
  const text = template.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_, name: string) => {
    if (values[name] === undefined) {
      missing.add(name);
      return "";
    }
    return values[name];
  });
  return { text, missing: [...missing] };
}

/** Picks an active chain at random, in proportion to its mix weight. */
export async function pickChain(supabase: SupabaseClient): Promise<{ chain: Chain | null; error: string | null }> {
  const { data, error } = await supabase.from("prompt_chains").select(CHAIN_COLUMNS).eq("is_active", true).gt("weight", 0);
  if (error) return { chain: null, error: error.message };
  const chains = (data ?? []) as Chain[];
  const total = chains.reduce((s, c) => s + c.weight, 0);
  if (!total) return { chain: null, error: null };
  let roll = Math.random() * total;
  for (const c of chains) {
    roll -= c.weight;
    if (roll < 0) return { chain: c, error: null };
  }
  return { chain: chains.at(-1) ?? null, error: null };
}

export async function getSteps(supabase: SupabaseClient, chainId: number) {
  const { data, error } = await supabase.from("prompt_chain_steps").select(STEP_COLUMNS).eq("chain_id", chainId).order("position").order("id");
  return { steps: (data ?? []) as Step[], error: error?.message ?? null };
}

/** The values for ${note}, ${terms} and ${examples}. */
export async function baseValues(supabase: SupabaseClient, note: string | null): Promise<Record<string, string>> {
  const [terms, examples] = await Promise.all([
    supabase.from("terms").select("term, definition, example").order("priority", { ascending: false }).order("term").limit(40),
    supabase.from("generation_examples").select("caption, image_description, why_funny").order("priority", { ascending: false }).order("id", { ascending: false }).limit(8),
  ]);
  const termList = (terms.data ?? []).map((t) => `- ${t.term}: ${t.definition}${t.example ? ` (e.g. "${t.example}")` : ""}`).join("\n");
  const exampleList = (examples.data ?? [])
    .map((e) => `- "${e.caption}"${e.image_description ? ` (photo: ${e.image_description})` : ""}${e.why_funny ? ` Why it worked: ${e.why_funny}` : ""}`)
    .join("\n");
  return {
    note: note ? `The poster's note about the photo: "${note}"` : "The poster added no note.",
    terms: termList || "(none yet)",
    examples: exampleList || "(none yet)",
  };
}

export type StepResult =
  | { ok: true; output: string; modelLabel: string; seconds: number; notes: string[] }
  | { ok: false; message: string };

/** Runs one step with the outputs of the steps before it, and logs the call. */
export async function runStep(
  supabase: SupabaseClient,
  input: { step: Step; values: Record<string, string>; outputs: string[]; image: LlmImage | null; requestId: number | null },
): Promise<StepResult> {
  const { step, outputs, image, requestId } = input;
  const values = { ...input.values };
  outputs.forEach((out, i) => (values[`step${i + 1}Output`] = out));

  const { data: modelRow } = await supabase
    .from("llm_models")
    .select("id, name, model_id, supports_temperature, llm_providers(slug)")
    .eq("id", step.model_id)
    .maybeSingle();
  const model = modelRow as ModelInfo | null;
  const providerRel = model?.llm_providers;
  const provider = (Array.isArray(providerRel) ? providerRel[0]?.slug : providerRel?.slug) ?? "groq";

  const system = fillPrompt(step.system_prompt, values);
  const user = fillPrompt(step.user_prompt, values);
  const notes: string[] = [];
  const missing = [...new Set([...system.missing, ...user.missing])];
  if (missing.length) notes.push(`Left empty (no value yet): ${missing.map((m) => "${" + m + "}").join(", ")}`);
  if (step.input === "image" && !image) return { ok: false, message: "This step needs the photo, but there is none." };

  const started = Date.now();
  const result = await callModel({
    provider,
    modelId: model?.model_id ?? "",
    system: system.text,
    user: user.text,
    image: step.input === "image" ? (image ?? undefined) : undefined,
    temperature: model && !model.supports_temperature ? null : step.temperature,
    json: step.output === "json",
  });
  const seconds = Math.round((Date.now() - started) / 100) / 10;
  if (!result.ok) return { ok: false, message: result.message };
  if (result.note) notes.push(result.note);

  const modelLabel = result.modelId;
  if (requestId !== null) {
    let loggedModelId: number | null = model?.id ?? null;
    if (result.modelId !== model?.model_id) {
      const { data: actual } = await supabase.from("llm_models").select("id").eq("model_id", result.modelId).limit(1).maybeSingle();
      loggedModelId = (actual?.id as number | undefined) ?? null;
    }
    const { error } = await supabase.from("llm_responses").insert({
      request_id: requestId,
      step_id: step.id,
      step_position: step.position,
      model_id: loggedModelId,
      model_label: modelLabel,
      system_prompt: system.text,
      user_prompt: user.text + (step.input === "image" ? "\n\n[attachment: the photo]" : ""),
      response: result.text,
      seconds,
    });
    if (error) notes.push(`This call could not be logged: ${error.message}`);
  }
  return { ok: true, output: result.text, modelLabel, seconds, notes };
}

export async function startRequest(
  supabase: SupabaseClient,
  input: { chainId: number; source: "app" | "admin" | "tool"; imagePath: string | null; postId?: number | null },
) {
  const { data, error } = await supabase
    .from("generation_requests")
    .insert({ chain_id: input.chainId, source: input.source, image_path: input.imagePath, post_id: input.postId ?? null })
    .select("id")
    .single();
  return { requestId: (data?.id as number | undefined) ?? null, error: error?.message ?? null };
}

export async function finishRequest(supabase: SupabaseClient, requestId: number | null, patch: { status: "done" | "failed"; error?: string | null; postId?: number | null }) {
  if (requestId === null) return;
  await supabase
    .from("generation_requests")
    .update({ status: patch.status, error: patch.error ?? null, ...(patch.postId ? { post_id: patch.postId } : {}) })
    .eq("id", requestId);
}

export type ChainRun =
  | { ok: true; chain: Chain; requestId: number | null; takes: ThreeTakes; finalStep: Step; finalPrompt: string; modelLabel: string }
  | { ok: false; message: string; chainMissing?: boolean };

/**
 * Runs a whole chain on a photo (Three Takes posts and the admin area use
 * this). Picks a chain by the mix weights unless chainId is given.
 */
export async function runChain(
  supabase: SupabaseClient,
  input: { image: LlmImage; note: string | null; imagePath: string | null; source: "app" | "admin" | "tool"; chainId?: number },
): Promise<ChainRun> {
  let chain: Chain | null = null;
  if (input.chainId) {
    const { data } = await supabase.from("prompt_chains").select(CHAIN_COLUMNS).eq("id", input.chainId).maybeSingle();
    chain = (data as Chain | null) ?? null;
  } else {
    const picked = await pickChain(supabase);
    if (picked.error) return { ok: false, message: picked.error, chainMissing: true };
    chain = picked.chain;
  }
  if (!chain) return { ok: false, message: "No active prompt chain has a weight above 0.", chainMissing: true };

  const { steps, error } = await getSteps(supabase, chain.id);
  if (error || !steps.length) return { ok: false, message: error ?? `The chain "${chain.name}" has no steps.`, chainMissing: !error };

  const { requestId } = await startRequest(supabase, { chainId: chain.id, source: input.source, imagePath: input.imagePath });
  const values = await baseValues(supabase, input.note);
  const outputs: string[] = [];
  let modelLabel = "";
  for (const step of steps) {
    const result = await runStep(supabase, { step, values, outputs, image: input.image, requestId });
    if (!result.ok) {
      await finishRequest(supabase, requestId, { status: "failed", error: `Step ${step.position}: ${result.message}` });
      return { ok: false, message: result.message };
    }
    outputs.push(result.output);
    modelLabel = result.modelLabel;
  }
  const final = steps.at(-1)!;
  const takes = parseThreeTakes(outputs.at(-1) ?? "");
  if (!takes) {
    await finishRequest(supabase, requestId, { status: "failed", error: "The last step did not return the three captions as JSON." });
    return { ok: false, message: "The AI replied in an unexpected format. Please try again." };
  }
  const finalPrompt = `[chain] ${chain.name} (${chain.slug}), step ${final.position} of ${steps.length}\n[system]\n${final.system_prompt}\n\n[user]\n${final.user_prompt}`;
  return { ok: true, chain, requestId, takes, finalStep: final, finalPrompt, modelLabel };
}
