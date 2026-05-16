# prompt_injection_eval

> :construction: Placeholder. The eval feeds a corpus of known prompt-injection
> phrases through ``POST /v1/documents`` and asserts the compiler downranks or
> excludes high-risk chunks. The detection logic itself is already tested in
> ``apps/api/app/tests/test_hardening.py::test_prompt_injection_chunk_is_excluded``.
