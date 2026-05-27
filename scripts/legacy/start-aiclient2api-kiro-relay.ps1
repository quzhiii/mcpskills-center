param(
  [int]$Port = 3000,
  [int]$InitialDelaySeconds = 25,
  [int]$Retries = 6,
  [int]$RetryDelaySeconds = 10,
  [string]$ProjectDir = "E:\fandai\AIClient-2-API",
  [string]$NodePath = "D:\Program Files\nodejs\node.exe"
)

$ErrorActionPreference = "Stop"

$logDir = Join-Path $ProjectDir "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$launcherLog = Join-Path $logDir "kiro-relay-startup-launcher.log"
$stdoutLog = Join-Path $logDir "kiro-relay-startup.out.log"
$stderrLog = Join-Path $logDir "kiro-relay-startup.err.log"

function Write-LauncherLog {
  param([string]$Message)
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  Add-Content -LiteralPath $launcherLog -Value $line -Encoding UTF8
}

function Test-PortListening {
  param([int]$TargetPort)
  $listening = netstat -ano | Select-String ":$TargetPort\s" | Select-String "LISTENING"
  return $null -ne $listening
}

Write-LauncherLog "launcher started; port=$Port project=$ProjectDir"

if ($InitialDelaySeconds -gt 0) {
  Write-LauncherLog "waiting initial delay ${InitialDelaySeconds}s"
  Start-Sleep -Seconds $InitialDelaySeconds
}

if (-not (Test-Path -LiteralPath $ProjectDir)) {
  Write-LauncherLog "project directory missing: $ProjectDir"
  exit 1
}

if (-not (Test-Path -LiteralPath $NodePath)) {
  Write-LauncherLog "node executable missing: $NodePath"
  exit 1
}

for ($attempt = 1; $attempt -le $Retries; $attempt++) {
  if (Test-PortListening -TargetPort $Port) {
    Write-LauncherLog "port $Port already listening; no action needed"
    exit 0
  }

  Write-LauncherLog "starting relay attempt $attempt/$Retries"
  Start-Process `
    -FilePath $NodePath `
    -ArgumentList @("src/core/master.js", "--no-ui") `
    -WorkingDirectory $ProjectDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog

  Start-Sleep -Seconds $RetryDelaySeconds
  if (Test-PortListening -TargetPort $Port) {
    Write-LauncherLog "relay is listening on port $Port"
    exit 0
  }

  Write-LauncherLog "relay not listening after attempt $attempt"
}

Write-LauncherLog "failed to start relay after $Retries attempts"
exit 2
