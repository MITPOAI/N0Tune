# @n0tune/vercel-ai-sdk

Vercel AI SDK bindings for [N0Tune](https://github.com/n0tune/n0tune).

```bash
npm install @n0tune/vercel-ai-sdk ai @ai-sdk/openai
```

## Talk to N0Tune through Vercel AI SDK

N0Tune's `/v1/openai` endpoint is OpenAI-compatible, so the integration is a
thin factory that wires `@ai-sdk/openai` at it. Streaming, tool use, and the
rest of the AI SDK API all "just work."

```ts
import { generateText, streamText } from "ai";
import { createN0TuneProvider } from "@n0tune/vercel-ai-sdk";

const n0tune = createN0TuneProvider({
  baseUrl: "http://localhost:8000",
  apiKey: process.env.N0TUNE_API_KEY,
  appId: "demo",
  userId: "user_1",
});

const { text } = await generateText({
  model: n0tune("n0tune/dev"),
  messages: [{ role: "user", content: "Explain RAG like before." }],
});

const result = await streamText({
  model: n0tune("n0tune/dev"),
  messages: [{ role: "user", content: "Explain RAG like before." }],
});
for await (const chunk of result.textStream) process.stdout.write(chunk);
```

The provider passes `X-N0Tune-App-ID`, `X-N0Tune-User-ID`, and the API key on
every request so N0Tune can scope memories, cache, and rate limits correctly.

## Use the compiler in front of a different model

If you want to keep `@ai-sdk/openai` (or `@ai-sdk/anthropic`, etc.) pointed at
the real provider but still let N0Tune choose the system prompt:

```ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { buildN0TuneSystemPrompt, createN0TuneClient } from "@n0tune/vercel-ai-sdk";

const client = createN0TuneClient({
  baseUrl: "http://localhost:8000",
  apiKey: process.env.N0TUNE_API_KEY,
});

const system = await buildN0TuneSystemPrompt({
  client,
  userId: "user_1",
  message: "Explain RAG like before.",
});

await generateText({
  model: openai("gpt-4o-mini"),
  system,
  messages: [{ role: "user", content: "Explain RAG like before." }],
});
```

`buildN0TuneSystemPrompt` calls `POST /v1/context/preview` under the hood and
returns the `compiled_context` field as the system prompt.

## Reach the rest of the N0Tune API

`createN0TuneClient` returns the standard `@n0tune/sdk` client so you can read
and write memories, style profiles, and documents from the same code:

```ts
const client = createN0TuneClient({ baseUrl, apiKey });
await client.createMemory({ user_id: "user_1", text: "User prefers diagrams." });
```

## Development

```bash
npm --workspace integrations/vercel-ai-sdk run typecheck
npm --workspace integrations/vercel-ai-sdk run build
npm --workspace integrations/vercel-ai-sdk test
```
