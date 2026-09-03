import { createHash } from "node:crypto";

const narrationCache = new Map<string, Promise<string>>();
const MAX_CACHE_ENTRIES = 48;

export class NarrationError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
    this.name = "NarrationError";
  }
}

function normalizeNarrationText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) throw new NarrationError("Narration text is required.", 400);
  if (normalized.length > 800) throw new NarrationError("Narration text is too long.", 400);
  return normalized;
}

async function requestNarration(text: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new NarrationError("Narration is not configured.", 503);

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: "cedar",
      input: text,
      response_format: "mp3",
      instructions:
        "Read only the supplied text. Sound calm, precise, and faintly bureaucratic, like a helpful voice transmitted through an old office intercom. Keep the pace measured and the words easy to understand. Do not add commentary.",
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 429 && /quota|billing|credits/i.test(detail)) {
      throw new NarrationError("Narration needs an OpenAI API billing balance. Background audio is still available.", 503);
    }
    throw new NarrationError("Narration could not be generated.", 502);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:audio/mpeg;base64,${bytes.toString("base64")}`;
}

export function generateNarrationDataUrl(input: string): Promise<string> {
  const text = normalizeNarrationText(input);
  const cacheKey = createHash("sha256").update(text).digest("hex");
  const cached = narrationCache.get(cacheKey);
  if (cached) return cached;

  if (narrationCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = narrationCache.keys().next().value;
    if (oldest) narrationCache.delete(oldest);
  }

  const request = requestNarration(text).catch((error) => {
    narrationCache.delete(cacheKey);
    throw error;
  });
  narrationCache.set(cacheKey, request);
  return request;
}
