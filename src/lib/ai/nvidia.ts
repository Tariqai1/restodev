/**
 * NVIDIA NIM AI Client & Inference Utilities
 * Powered by NVIDIA Inference Microservices (Meta Llama 3.3 70B, Nemotron 3.5, Llama 3.2 Vision)
 */

const DEFAULT_NVIDIA_KEY = "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";
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

export type NvidiaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
};

export type NvidiaCompletionOptions = {
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  timeoutMs?: number;
};

export async function callNvidiaChat(
  messages: NvidiaChatMessage[],
  options: NvidiaCompletionOptions = {}
): Promise<{ text: string; raw: any }> {
  const apiKey = process.env.NVIDIA_API_KEY || DEFAULT_NVIDIA_KEY;
  const model = options.model || "meta/llama-3.2-11b-vision-instruct";
  const temperature = options.temperature ?? 0.2;
  const top_p = options.top_p ?? 0.95;
  const max_tokens = options.max_tokens ?? 800;
  const timeoutMs = options.timeoutMs ?? 15000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        top_p,
        max_tokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[AI Service] ${model} Error (${res.status}):`, errText);
      throw new Error(`AI service returned status ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    return { text: content, raw: data };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error("AI request timed out");
    }
    throw err;
  }
}

/**
 * Extracts and parses JSON block from model response (handles ```json fences)
 */
export function extractJsonFromResponse<T = any>(text: string): T | null {
  try {
    // 1. Try direct parse
    return JSON.parse(text);
  } catch (_) {
    // 2. Try fenced block ```json ... ```
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch (_) {}
    }
    // 3. Try finding first { or [
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch (_) {}
    }

    const firstBracket = text.indexOf("[");
    const lastBracket = text.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(text.slice(firstBracket, lastBracket + 1));
      } catch (_) {}
    }

    return null;
  }
}
