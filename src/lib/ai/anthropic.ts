export interface AnthropicChatOptions {
  apiKey: string;
  model: string;
  prompt: string;
}

export async function anthropicChat(opts: AnthropicChatOptions): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 1200,
      temperature: 0.4,
      system: "You help draft performance plan progress reviews. Output concise, professional markdown.",
      messages: [
        { role: "user", content: opts.prompt }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${text}`);
  }
  const json = await res.json() as any;
  const content = json.content?.[0]?.text ?? "";
  return String(content).trim();
}
