param(
    [string]$BaseUrl = "http://localhost:8000",
    [string]$AppId = "demo",
    [string]$UserId = "n0tune_builder"
)

$ErrorActionPreference = "Stop"

function ConvertTo-QueryValue {
    param([string]$Value)
    return [System.Uri]::EscapeDataString($Value)
}

function Get-Sha256Hex {
    param([string]$Value)

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
        $hashBytes = $sha.ComputeHash($bytes)
        return -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
    }
    finally {
        $sha.Dispose()
    }
}

$memories = @(
    @{
        app_id = $AppId
        user_id = $UserId
        type = "project"
        text = "N0Tune is a context-tuning system. Bring any AI model (OpenAI / Anthropic / Gemini / Qwen / OpenRouter / Ollama / LM Studio / OpenAI-compatible). N0Tune adds local memory, persona, indexed files, semantic cache, and a context compiler. Same model, personal answer, no fine-tuning."
        confidence = 1.0
    },
    @{
        app_id = $AppId
        user_id = $UserId
        type = "project"
        text = "N0Tune has two equal surfaces: a standalone Desktop app (Tauri, local SQLite + OS keychain) AND an integration layer (MCP server, OpenAI-compatible proxy, SDKs) for Claude Code / Cursor / Codex CLI / etc. Both are first-class."
        confidence = 1.0
    },
    @{
        app_id = $AppId
        user_id = $UserId
        type = "project"
        text = "N0Tune is Apache-2.0 licensed and has zero telemetry by design. Desktop memory is local (SQLite + OS keychain); Gateway memory is Postgres only when the server runs."
        confidence = 1.0
    },
    @{
        app_id = $AppId
        user_id = $UserId
        type = "project"
        text = "N0Tune does not hardcode any model or provider. Every model name in the code is a default the user can override."
        confidence = 1.0
    },
    @{
        app_id = $AppId
        user_id = $UserId
        type = "project"
        text = "Desktop runs on Windows, macOS, and Linux only. iOS and Android are not targets."
        confidence = 1.0
    },
    @{
        app_id = $AppId
        user_id = $UserId
        type = "preference"
        text = "N0Tune docs should be direct, security-aware, and implementation-ready. No hype; every claim must be reachable from a local proof path."
        confidence = 0.95
    }
)

$appQuery = ConvertTo-QueryValue $AppId
$userQuery = ConvertTo-QueryValue $UserId
$existingMemories = @(Invoke-RestMethod -Method Get -Uri "$BaseUrl/v1/memories?app_id=$appQuery&user_id=$userQuery&limit=200")

foreach ($memory in $memories) {
    $alreadyExists = @($existingMemories | Where-Object { $_.type -eq $memory.type -and $_.text -eq $memory.text }).Count -gt 0
    if ($alreadyExists) {
        Write-Host "Skipping existing memory: $($memory.text)"
        continue
    }

    Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/memories" -ContentType "application/json" -Body ($memory | ConvertTo-Json -Depth 5)
}

$style = @{
    app_id = $AppId
    profile_json = @{
        tone = "direct"
        depth = "medium"
        format = "short sections with code examples"
        avoid = @("hype", "unsupported claims", "giant prompts")
    }
}
Invoke-RestMethod -Method Patch -Uri "$BaseUrl/v1/users/$UserId/style" -ContentType "application/json" -Body ($style | ConvertTo-Json -Depth 5)

$documentsToIndex = @(
    @{ source = "docs/context-compiler.md"; title = "N0Tune Context Compiler documentation" },
    @{ source = "docs/product-direction.md"; title = "N0Tune product direction (armor framing)" },
    @{ source = "docs/how-it-works.md"; title = "How N0Tune works per AI tool" },
    @{ source = "docs/install.md"; title = "N0Tune installation guide" },
    @{ source = "docs/wire-to-claude.md"; title = "Wire N0Tune to Claude Desktop/Code/Cursor via MCP" },
    @{ source = "docs/wire-to-codex-cli.md"; title = "Wire N0Tune to Codex CLI via MCP" },
    @{ source = "docs/wire-to-gemini-cli.md"; title = "Wire N0Tune to Gemini CLI via adapter + hotkey" },
    @{ source = "CLAUDE.md"; title = "N0Tune operating manual for Claude Code" },
    @{ source = "AGENTS.md"; title = "N0Tune operating manual for non-Claude agents" }
)

$existingDocuments = @(Invoke-RestMethod -Method Get -Uri "$BaseUrl/v1/documents?app_id=$appQuery")

foreach ($doc in $documentsToIndex) {
    $docPath = (Resolve-Path -LiteralPath $doc.source -ErrorAction SilentlyContinue)
    if (-not $docPath) {
        Write-Host "Skipping missing document: $($doc.source)"
        continue
    }
    $docContent = [System.IO.File]::ReadAllText($docPath.Path, [System.Text.Encoding]::UTF8)
    $docHash = Get-Sha256Hex $docContent
    $document = @{
        app_id = $AppId
        title = $doc.title
        source = $doc.source
        content = $docContent
        metadata_json = @{ dogfooding = $true; phase = "armor" }
    }
    $documentAlreadyExists = @($existingDocuments | Where-Object {
        $_.source -eq $document.source -and $_.content_hash -eq $docHash
    }).Count -gt 0
    if ($documentAlreadyExists) {
        Write-Host "Skipping existing document: $($document.source)"
    }
    else {
        Write-Host "Indexing $($document.source)"
        Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/documents" -ContentType "application/json" -Body ($document | ConvertTo-Json -Depth 5) | Out-Null
    }
}

$previews = @(
    "How does N0Tune compile context for a request?",
    "What is N0Tune and how is it different from a chat app?",
    "How do I wire N0Tune to Claude Code?"
)

foreach ($prompt in $previews) {
    Write-Host ""
    Write-Host "--- Context preview: $prompt ---"
    $preview = @{
        app_id = $AppId
        user_id = $UserId
        message = $prompt
        max_context_tokens = 1200
    }
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/context/preview" -ContentType "application/json" -Body ($preview | ConvertTo-Json)
}
