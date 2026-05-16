param(
    [string]$Python = ".\.venv\Scripts\python.exe"
)

$ErrorActionPreference = "Stop"

& "$PSScriptRoot\check-mvp.ps1" -Python $Python
