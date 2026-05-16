# Two-user personalization demo

> :construction: This example is a placeholder for the headline N0Tune demo:
>
> > Same model. Same question. Different personalized answers. Fewer tokens.
> > No fine-tuning.
>
> The runnable script lands in **v1.0** alongside the eval harness. The
> shape below documents the contract the example will meet so the README
> link and the demo's CLI surface remain stable.

## What this example will demonstrate

Two users share the same N0Tune deployment, the same upstream model, and
the same question. They get different answers because N0Tune compiles a
different compact context for each.

```
User A — preferences: terse, code examples, no diagrams
User B — preferences: beginner, analogies, diagrams welcome

Both ask: "What is RAG?"

Result:
  - same model (n0tune/dev or your configured provider)
  - different compiled context (memories + style profile per user)
  - different answers
  - token-savings estimate printed for each call
  - no fine-tuning involved
```

## How it will run

```bash
docker compose up -d --wait
python -m examples.personalized_rag_demo.seed     # creates user_a, user_b, memories
python -m examples.personalized_rag_demo.run      # asks the same question twice
```

Or, once the CLI ships:

```bash
n0tune demo
```

## Until the script lands

You can already reproduce the scenario by hand against a running stack:

```bash
# Seed memories for user_a
curl -s -X POST http://localhost:8000/v1/memories \
  -H "Content-Type: application/json" \
  -d '{ "app_id": "demo", "user_id": "user_a", "type": "preference",
        "text": "Prefer terse code-first answers.", "confidence": 0.95 }'

# Seed memories for user_b
curl -s -X POST http://localhost:8000/v1/memories \
  -H "Content-Type: application/json" \
  -d '{ "app_id": "demo", "user_id": "user_b", "type": "preference",
        "text": "Prefer beginner explanations with analogies and diagrams.",
        "confidence": 0.95 }'

# Ask the same question for each user and compare context + answer
for user in user_a user_b; do
  echo "=== $user ==="
  curl -s -X POST http://localhost:8000/v1/chat \
    -H "Content-Type: application/json" \
    -d "{ \"app_id\": \"demo\", \"user_id\": \"$user\", \"message\": \"What is RAG?\" }" | jq
done
```

You'll see the same model serving both calls, but the `selected_memories`
and `tokens_saved_estimated` fields diverge — and the compiled prompts (visible
via `/v1/context/preview` with the same payload) reflect each user's
preferences.

## Why this is the demo we lead with

Fine-tuning would solve the personalization, but at the cost of separate
model weights per user. N0Tune solves it by changing the **context**, not
the model — which is what the headline tagline means.
