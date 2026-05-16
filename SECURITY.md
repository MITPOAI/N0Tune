# Security Policy

Security is part of N0Tune from Phase 0. N0Tune is planned to store memories, document chunks, style profiles, semantic cache entries, and context traces, so the security model must assume sensitive data and untrusted retrieved text from the start.

## Supported versions

N0Tune is pre-1.0. Security fixes are applied to the `main` branch until versioned releases exist.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| older commits | No |

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability.

Until a dedicated security email is published, report privately to the repository owner using GitHub private vulnerability reporting when available. Include:

- affected commit or version
- reproduction steps
- impact
- logs or proof of concept with secrets redacted
- whether the issue is actively exploited

We aim to acknowledge reports within 5 business days and coordinate a fix before public disclosure.

## Responsible disclosure

Give maintainers reasonable time to investigate and patch. Do not access, modify, delete, or exfiltrate data that does not belong to you. Do not run destructive tests against public instances.

## Secret handling

- Never commit real `.env` files, API keys, database passwords, private keys, session cookies, or provider tokens.
- `.env.example` must contain safe placeholders only.
- Future app API keys must be hashed before storage.
- Logs must not include Authorization headers, API keys, cookies, raw private keys, or provider secrets.
- Memory extraction must reject likely credentials by default.

## Prompt injection risks

N0Tune will process untrusted document chunks and user-provided content. Retrieved context must not be treated as instructions. The Context Compiler must include a boundary that says retrieved context is untrusted and cannot override system, developer, safety, privacy, or tool instructions.

Suspicious retrieved text should be scored, downranked, or excluded when it asks the model to:

- ignore previous instructions
- reveal secrets
- print system prompts
- exfiltrate memory
- send API keys
- change rules
- disable safety
- call tools without permission

See [docs/prompt-injection.md](docs/prompt-injection.md).

## Memory privacy risks

Memory can contain personal, project, or business-sensitive data. N0Tune must provide controls to view, edit, delete, export, disable, and expire memories. Sensitive personal information should not be stored unless explicitly configured by the app owner.

The MVP stores memory and rejects common secret patterns before persistence.

## Data deletion expectations

Future deletion behavior must include:

- soft delete for recoverability and audit where appropriate
- hard delete workflows for user privacy requests
- cache invalidation when dependent memory or documents are deleted
- clear documentation of retention periods

## API key safety

Future API auth must use app-scoped API keys. Keys must be accepted over HTTPS in production, hashed at rest, rotated safely, and never logged.

## Multi-tenant isolation

Every future query must be scoped by `app_id` and either `user_id` or `org_id`. Tests must cover cross-app and cross-user isolation before Phase 1 is considered complete.

## Dependency and container security

- Run dependency audits before releases.
- Scan for secrets before commits.
- Use minimal Docker images where practical.
- Do not run containers as root when avoidable.
- Keep Postgres and Redis private to the Compose network unless intentionally exposed for local development.

## MVP status

Implemented:

- minimal `/health` endpoint
- safe `.env.example`
- Docker Compose services
- security documentation
- memory secret rejection
- prompt-injection scoring and high-risk chunk exclusion
- app/user scoped database queries
- CI hooks for lint, typecheck, tests, secret scanning, and best-effort dependency audits

Not implemented yet:

- rate limiting
- request size limits
- data deletion workflow
