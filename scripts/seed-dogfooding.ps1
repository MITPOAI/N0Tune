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
        text = "N0Tune is a Context Compiler and AI Memory Gateway, not only memory, RAG, cache, or prompt compression."
        confidence = 1.0
    },
    @{
        app_id = $AppId
        user_id = $UserId
        type = "project"
        text = "N0Tune uses Apache-2.0 for open-source friendliness and patent protection."
        confidence = 1.0
    },
    @{
        app_id = $AppId
        user_id = $UserId
        type = "preference"
        text = "N0Tune docs should be direct, security-aware, and implementation-ready."
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

$docPath = (Resolve-Path -LiteralPath "docs/context-compiler.md").Path
$docContent = [System.IO.File]::ReadAllText($docPath, [System.Text.Encoding]::UTF8)
$docHash = Get-Sha256Hex $docContent
$existingDocuments = @(Invoke-RestMethod -Method Get -Uri "$BaseUrl/v1/documents?app_id=$appQuery")
$document = @{
    app_id = $AppId
    title = "N0Tune Context Compiler documentation"
    source = "docs/context-compiler.md"
    content = $docContent
    metadata_json = @{ dogfooding = $true; phase = "6" }
}
$documentAlreadyExists = @($existingDocuments | Where-Object { $_.source -eq $document.source -and $_.content_hash -eq $docHash }).Count -gt 0
if ($documentAlreadyExists) {
    Write-Host "Skipping existing document: $($document.source)"
}
else {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/documents" -ContentType "application/json" -Body ($document | ConvertTo-Json -Depth 5)
}

$preview = @{
    app_id = $AppId
    user_id = $UserId
    message = "How does N0Tune compile context for a request?"
    max_context_tokens = 1200
}
Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/context/preview" -ContentType "application/json" -Body ($preview | ConvertTo-Json)
