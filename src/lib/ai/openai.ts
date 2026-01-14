export interface OpenAIChatOptions {
  apiKey: string;
  model: string;
  prompt: string;
}

export async function openaiChat(opts: OpenAIChatOptions): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${opts.apiKey}`
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: "system", content: "You help draft performance plan progress reviews. Output concise, professional markdown." },
        { role: "user", content: opts.prompt }
      ],
      temperature: 0.4
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }
  const json = await res.json() as any;
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}
