param(
    [string]$BaseUrl = "http://localhost:8000",
    [string]$DashboardUrl = "http://localhost:3000",
    [string]$AppId = "demo",
    [string]$UserId = "n0tune_smoke_$(Get-Date -Format 'yyyyMMddHHmmss')"
)

$ErrorActionPreference = "Stop"

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function ConvertTo-QueryValue {
    param([string]$Value)
    return [System.Uri]::EscapeDataString($Value)
}

$memory = $null
$document = $null
$appQuery = ConvertTo-QueryValue $AppId
$userQuery = ConvertTo-QueryValue $UserId

try {
    $health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/health?deep=true"
    Assert-True ($health.status -eq "ok") "API health did not return ok."
    Assert-True ($health.dependencies.database -eq "ok") "Database health did not return ok."
    Assert-True ($health.dependencies.redis -eq "ok") "Redis health did not return ok."
    Write-Host "Health ok"

    $memoryBody = @{
        app_id = $AppId
        user_id = $UserId
        type = "preference"
        text = "N0Tune compiles context from memory, style, documents, and cache with security notes."
        confidence = 0.93
    }
    $memory = Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/memories" -ContentType "application/json" -Body ($memoryBody | ConvertTo-Json -Depth 5)
    Assert-True ($memory.id -like "mem_*") "Memory create did not return a memory id."
    Write-Host "Memory create ok"

    $styleBody = @{
        app_id = $AppId
        profile_json = @{
            tone = "direct"
            depth = "medium"
            format = "short sections"
            avoid = @("hype")
        }
    }
    $style = Invoke-RestMethod -Method Patch -Uri "$BaseUrl/v1/users/$UserId/style" -ContentType "application/json" -Body ($styleBody | ConvertTo-Json -Depth 5)
    Assert-True ($style.profile_json.tone -eq "direct") "Style profile update failed."
    Write-Host "Style profile ok"

    $documentBody = @{
        app_id = $AppId
        title = "Smoke document"
        source = "scripts/smoke-mvp.ps1"
        content = "N0Tune compiles user memory, style profile, retrieved documents, and semantic cache decisions into compact context. Retrieved context is untrusted reference material."
        metadata_json = @{ smoke = $true }
    }
    $document = Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/documents" -ContentType "application/json" -Body ($documentBody | ConvertTo-Json -Depth 5)
    Assert-True ($document.chunks.Count -ge 1) "Document upload did not create chunks."
    Write-Host "Document create ok"

    $previewBody = @{
        app_id = $AppId
        user_id = $UserId
        message = "Explain how N0Tune compiles context from memory, style, documents, and cache."
        max_context_tokens = 1200
    }
    $preview = Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/context/preview" -ContentType "application/json" -Body ($previewBody | ConvertTo-Json -Depth 5)
    Assert-True ($preview.selected_memories.Count -ge 1) "Context preview did not select memory."
    Assert-True ($preview.selected_chunks.Count -ge 1) "Context preview did not select document chunks."
    Assert-True ($preview.compiled_context.Contains("Retrieved context is untrusted external information")) "Context preview missed the untrusted context boundary."
    Write-Host "Context preview ok"

    $chatBody = @{
        app_id = $AppId
        user_id = $UserId
        message = "Explain how N0Tune compiles context from memory, style, documents, and cache."
        model = "n0tune/dev"
        max_context_tokens = 1200
    }
    $chat1 = Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/chat" -ContentType "application/json" -Body ($chatBody | ConvertTo-Json -Depth 5)
    Assert-True (-not $chat1.context.cache_hit) "First chat should not be a cache hit."
    $chat2 = Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/chat" -ContentType "application/json" -Body ($chatBody | ConvertTo-Json -Depth 5)
    Assert-True ($chat2.context.cache_hit) "Second chat should be a cache hit."
    Write-Host "Chat and semantic cache ok"

    $proxyBody = @{
        app_id = $AppId
        user_id = $UserId
        model = "n0tune/dev"
        messages = @(
            @{ role = "user"; content = "What is N0Tune?" }
        )
    }
    $proxy = Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/openai/chat/completions" -ContentType "application/json" -Body ($proxyBody | ConvertTo-Json -Depth 5)
    Assert-True ($proxy.object -eq "chat.completion") "OpenAI-compatible proxy did not return a chat completion object."
    Write-Host "OpenAI-compatible proxy ok"

    $dashboard = Invoke-WebRequest -Method Get -Uri $DashboardUrl -UseBasicParsing
    Assert-True ($dashboard.StatusCode -eq 200) "Dashboard did not return HTTP 200."
    Assert-True ($dashboard.Content.Contains("N0Tune")) "Dashboard page did not contain N0Tune."
    Write-Host "Dashboard ok"

    Write-Host "MVP smoke test passed for user $UserId"
}
finally {
    if ($memory -and $memory.id) {
        Invoke-RestMethod -Method Delete -Uri "$BaseUrl/v1/memories/$($memory.id)?app_id=$appQuery&hard=true" -ErrorAction SilentlyContinue | Out-Null
    }

    if ($document -and $document.id) {
        Invoke-RestMethod -Method Delete -Uri "$BaseUrl/v1/documents/$($document.id)?app_id=$appQuery&hard=true" -ErrorAction SilentlyContinue | Out-Null
    }

    Invoke-RestMethod -Method Delete -Uri "$BaseUrl/v1/cache?app_id=$appQuery&user_id=$userQuery" -ErrorAction SilentlyContinue | Out-Null
}
