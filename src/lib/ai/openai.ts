import { getHttpsAgent } from "../httpAgent.js";
import https from "https";

export interface OpenAIChatOptions {
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

export async function openaiChat(opts: OpenAIChatOptions): Promise<string> {
  const agent = getHttpsAgent();
  const body = JSON.stringify({
    model: opts.model,
    messages: [
      { role: "user", content: opts.prompt }
    ],
    temperature: 0.4
  });

  const res = await makeHttpsRequest(
    "https://api.openai.com/v1/chat/completions",
    "POST",
    {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${opts.apiKey}`
    },
    body,
    agent
  );

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`OpenAI error ${res.status}: ${res.body}`);
  }

  const json = JSON.parse(res.body) as any;
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}
