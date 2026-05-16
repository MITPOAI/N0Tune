# @n0tune/sdk

TypeScript SDK for the N0Tune API.

```ts
import { N0TuneClient, n0tuneVersion, phaseStatus } from "@n0tune/sdk";

console.log(n0tuneVersion);
console.log(phaseStatus.implemented);

const client = new N0TuneClient({ baseUrl: "http://localhost:8000" });
await client.createMemory({
  app_id: "demo",
  user_id: "user_123",
  type: "preference",
  text: "User prefers concise answers.",
});
const preview = await client.contextPreview({
  app_id: "demo",
  user_id: "user_123",
  message: "Explain RAG like before",
});
console.log(preview.compiled_context);
```
