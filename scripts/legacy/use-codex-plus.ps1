$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "switch-codex-route.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File $scriptPath official
