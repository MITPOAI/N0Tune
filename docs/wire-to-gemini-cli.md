# Wire N0Tune to Gemini CLI

[Google's Gemini CLI](https://github.com/google-gemini/gemini-cli) is a
terminal-native coding agent. As of this release Gemini CLI's MCP support
is limited compared to Claude / Cursor / Codex, so we ship **two paths** —
pick whichever fits your workflow.

## What you'll have when this is done

- Path A: every Gemini CLI invocation includes a personalized system
  prompt compiled from your N0Tune memory + style + files.
- Path B: you capture facts as memories using the desktop tray hotkey
  while you work in Gemini CLI; future runs benefit from them.

You can combine both.

## Path A — Compiled-prompt adapter (recommended)

The N0Tune CLI's `compile` subcommand returns the compiled context as
plain text. Pipe it into Gemini CLI as a system prompt.

### Prerequisites

1. **Gateway running** — same as Claude / Codex paths. See
   [`wire-to-claude.md#prerequisites`](wire-to-claude.md#prerequisites).
2. **`n0tune` CLI on PATH** — for now run via `node packages/cli/bin/n0tune.mjs`.
3. **Gemini CLI installed** and reachable as `gemini`.

### One-shot prompt

```bash
# 1) Compile the prompt N0Tune would have built for this question:
node packages/cli/bin/n0tune.mjs compile \
  --user-id "you" \
  "Explain how retrieval-augmented generation works." > /tmp/n0tune-prompt.txt

# 2) Hand it to Gemini CLI as the system prompt:
gemini chat \
  --system-prompt-file /tmp/n0tune-prompt.txt \
  "Explain how retrieval-augmented generation works."
```

Gemini answers with your style profile + relevant memories baked into the
system prompt. Same model. Different prompt. Personal answer.

> The `--system-prompt-file` flag name varies across Gemini CLI versions;
> check `gemini chat --help` for the equivalent on your install. Some
> versions accept `--system "$(cat …)"` instead.

### Wrap it in a shell function

Add this to your `~/.bashrc` / `~/.zshrc` for a one-word command:

```bash
gn0tune() {
  local user_id="${N0TUNE_USER_ID:-you}"
  local prompt_file
  prompt_file="$(mktemp)"
  node /absolute/path/to/N0Tune/packages/cli/bin/n0tune.mjs compile \
    --user-id "$user_id" \
    "$*" > "$prompt_file"
  gemini chat --system-prompt-file "$prompt_file" "$*"
  rm -f "$prompt_file"
}
```

Then:

```bash
gn0tune "Walk me through context-tuning."
```

### Memory writes from this path

Path A handles **reads** automatically. To **write** new memories you
learned during a Gemini session, append a tail to the wrapper that pipes
the relevant takeaway to `n0tune memory add`:

```bash
n0tune_remember() {
  node /absolute/path/to/N0Tune/packages/cli/bin/n0tune.mjs memory add "$*"
}

# After Gemini answers and you've noticed a preference worth saving:
n0tune_remember "I prefer terse code-first answers with ASCII diagrams."
```

## Path B — Tray hotkey (fallback for any tool)

Even without Path A, the Desktop tray's global hotkey works while Gemini
CLI is running — it doesn't care which window is focused.

1. Start the Desktop: `npm --workspace apps/desktop run tauri:dev`
2. Default hotkey: `Cmd+Shift+Space` (macOS), `Alt+Space` (Windows/Linux).
3. Press the hotkey → the quick-remember overlay opens pre-filled with
   the system clipboard.
4. Type / edit the memory text → Enter to save → ESC to dismiss.

Memories saved this way are available to Path A on the next compile.

## Recall in Gemini without Path A

If you don't want a wrapper, you can ask Gemini directly to fetch from
N0Tune via the OpenAI-compatible Gateway. Point Gemini at the Gateway
proxy:

```bash
# In Gemini CLI's config (this varies by version):
gemini config set openai_base_url "http://localhost:8000/v1/openai"
gemini config set openai_api_key "replace-with-local-development-key"
```

Then Gemini routes through the Gateway's `/v1/openai/chat/completions`
proxy, which compiles your memory in before forwarding to the upstream
provider. Note that this only works if your Gemini CLI version exposes
an OpenAI-compatible mode — older versions don't.

## What about real MCP support?

Gemini CLI's MCP support is evolving. When it stabilizes:

1. The same MCP server (`integrations/mcp-server/src/server.mjs`) plugs in
   the same way as for Claude / Codex / Cursor.
2. We'll add a Gemini-specific config snippet to this page.

Track the upstream issue: <https://github.com/google-gemini/gemini-cli/issues>
(search for "MCP").

## Security defaults

- The CLI `compile` subcommand fetches from the Gateway over localhost.
  Treat the Gateway URL the same way you'd treat any local service —
  bind to `127.0.0.1` only unless you mean to expose it.
- The compiled prompt **does** include the text of selected memories
  (otherwise the model couldn't use them). Don't pipe it into a tool
  you don't trust.
- The tray hotkey path stores memories through the same secret detector
  the Gateway uses — obvious API keys / private keys / passwords are
  rejected at write time.

## Turning it off

- Path A: stop running the wrapper / `compile` command.
- Path B: quit the Desktop app from the tray menu.

Memories you saved remain in the Gateway until you `n0tune memory
delete` them.

## See also

- [`wire-to-claude.md`](wire-to-claude.md) — MCP path for Claude / Cursor.
- [`wire-to-codex-cli.md`](wire-to-codex-cli.md) — MCP path for Codex CLI.
- [`providers.md`](providers.md) — native Gemini provider when N0Tune
  itself is the chat client (not the case here).