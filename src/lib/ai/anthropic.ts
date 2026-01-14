import { getHttpsAgent } from "../httpAgent.js";
import https from "https";

export interface AnthropicChatOptions {
  apiKey: string;
  model: string;
  prompt: string;
}

function makeHttpsRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string,
  agent: https.Agent
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        "Content-Length": Buffer.byteLength(body),
        ...headers,
      },
      agent,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode || 500,
          body: data,
        });
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export async function anthropicChat(opts: AnthropicChatOptions): Promise<string> {
  const agent = getHttpsAgent();
  
  const body = JSON.stringify({
    model: opts.model,
    max_tokens: 1200,
    temperature: 0.4,
    messages: [
      { role: "user", content: opts.prompt }
    ]
  });

  const res = await makeHttpsRequest(
    "https://api.anthropic.com/v1/messages",
    "POST",
    {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body,
    agent
  );

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Anthropic error ${res.status}: ${res.body}`);
  }

  const json = JSON.parse(res.body) as any;
  const content = json.content?.[0]?.text ?? "";
  return String(content).trim();
}
