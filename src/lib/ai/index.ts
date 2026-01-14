import { openaiChat } from "./openai.js";
import { anthropicChat } from "./anthropic.js";

export type ProviderName = "openai" | "anthropic";

export function getProvider(): ProviderName {
  const p = (process.env.AI_PROVIDER || "openai").toLowerCase();
  return (p === "anthropic" ? "anthropic" : "openai");
}

export function getModel(provider: ProviderName): string {
  if (provider === "anthropic") return process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

export async function runAI(prompt: string): Promise<{ provider: ProviderName; model: string; output: string; }> {
  const provider = getProvider();
  const model = getModel(provider);

  const maxChars = Number(process.env.MAX_PROMPT_CHARS || "12000");
  const safePrompt = prompt.length > maxChars ? prompt.slice(0, maxChars) + "\n\n[TRUNCATED]" : prompt;

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
    const output = await anthropicChat({ apiKey, model, prompt: safePrompt });
    return { provider, model, output };
  }

  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  const output = await openaiChat({ apiKey, model, prompt: safePrompt });
  return { provider, model, output };
}
