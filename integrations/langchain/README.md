# n0tune-langchain

LangChain bindings for [N0Tune](https://github.com/n0tune/n0tune) — use the
N0Tune Context Compiler as a LangChain retriever, and write user memories
with a small helper.

```bash
pip install n0tune-langchain
```

## Retriever

```python
from n0tune import N0TuneClient
from n0tune_langchain import N0TuneRetriever

client = N0TuneClient(base_url="http://localhost:8000", api_key="local")
retriever = N0TuneRetriever(client=client, user_id="user_1")

docs = retriever.invoke("Explain RAG like before.")
for doc in docs:
    print(doc.metadata["kind"], "::", doc.page_content)
```

Each returned `langchain_core.documents.Document` is one of:

- `metadata["kind"] == "memory"` — a user memory selected by the compiler.
  Metadata includes `memory_id`, `memory_type`, `confidence`, `similarity`.
- `metadata["kind"] == "chunk"` — a document chunk that passed the
  prompt-injection filter. Metadata includes `chunk_id`, `document_id`,
  `chunk_index`, `injection_risk_score`, `similarity`.

Wire it into any chain that takes a retriever, e.g. `create_retrieval_chain`:

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are concise. Use the supplied N0Tune context: {context}"),
    ("user", "{input}"),
])
combine = create_stuff_documents_chain(ChatOpenAI(model="gpt-4o-mini"), prompt)
chain = create_retrieval_chain(retriever, combine)
chain.invoke({"input": "Explain RAG like before."})
```

## Memory helper

```python
from n0tune_langchain import N0TuneMemoryStore

store = N0TuneMemoryStore(client=client, user_id="user_1")
store.save("User likes concise architecture answers.", type="preference")
store.search("architecture")
store.forget("mem_abc")
```

`N0TuneMemoryStore` is intentionally a plain helper rather than a subclass of
LangChain's `BaseChatMemory`: N0Tune memories model distilled long-term facts,
not raw chat turns, and the shapes do not map cleanly. Call this helper from
your own post-call hook to persist new memories.

## Development

```bash
pip install -e "integrations/langchain[dev]"
pytest integrations/langchain
ruff check integrations/langchain
```
