# Token Savings

N0Tune should reduce prompt tokens by omitting context that is not worth sending.

## Principle

The cheapest token is the token never sent.

N0Tune should not only compress text. It should decide which memories, chunks, and style hints deserve prompt space.

## MVP estimate

Context runs report:

- estimated prompt tokens
- estimated tokens saved
- selected memories
- selected document chunks
- omitted context
- reason trace

Example:

```json
{
  "prompt_tokens_estimated": 900,
  "tokens_saved_estimated": 4200
}
```

## What counts as savings?

Potential savings come from avoiding:

- full chat history
- repeated system prompt fragments
- unrelated RAG chunks
- stale memories
- low-confidence memories
- redundant facts
- unsafe retrieved text

## Current status

The MVP uses a lightweight character-based token estimate and compares compiled context to a naive "send all memories and chunks" baseline. This is useful for smoke testing and product transparency, but not a billing-grade tokenizer.
