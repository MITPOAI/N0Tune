# n0tune-llamaindex

LlamaIndex bindings for [N0Tune](https://github.com/n0tune/n0tune) — use the
N0Tune Context Compiler as a LlamaIndex retriever, plus a small helper for
writing user memories.

```bash
pip install n0tune-llamaindex
```

## Retriever

```python
from n0tune import N0TuneClient
from n0tune_llamaindex import N0TuneRetriever
from llama_index.core.schema import QueryBundle

client = N0TuneClient(base_url="http://localhost:8000", api_key="local")
retriever = N0TuneRetriever(client=client, user_id="user_1")

nodes = retriever.retrieve(QueryBundle(query_str="Explain RAG like before."))
for node in nodes:
    kind = node.node.metadata["kind"]
    print(kind, "::", node.node.get_content(), "score=", node.score)
```

Each node carries `metadata["kind"]` of either `"memory"` or `"chunk"`. The
node score mirrors the N0Tune similarity, so downstream rankers see a
consistent signal.

To use it in a `QueryEngine`:

```python
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.llms.openai import OpenAI

engine = RetrieverQueryEngine.from_args(retriever, llm=OpenAI(model="gpt-4o-mini"))
print(engine.query("Explain RAG like before."))
```

## Memory helper

```python
from n0tune_llamaindex import N0TuneMemoryStore

store = N0TuneMemoryStore(client=client, user_id="user_1")
store.save("User likes outlines.", type="preference")
store.search("outline")
store.forget("mem_abc")
```

## Development

```bash
pip install -e "integrations/llamaindex[dev]"
pytest integrations/llamaindex
ruff check integrations/llamaindex
```
