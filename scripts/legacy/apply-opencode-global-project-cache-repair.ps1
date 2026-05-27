$ErrorActionPreference = "Stop"

$ProjectDir = "C:\Users\quzhi\Documents\New project"
$DbPath = "C:\Users\quzhi\.local\share\opencode\opencode.db"
$GlobalDatPath = "C:\Users\quzhi\AppData\Roaming\ai.opencode.desktop\opencode.global.dat"
$RepairScript = Join-Path $ProjectDir "dry-run-repair-global-project-cache.js"
$AnalyzeScript = Join-Path $ProjectDir "analyze-opencode-history.js"
$BackupRoot = "C:\Users\quzhi\AppData\Roaming\ai.opencode.desktop\repair-backups"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $BackupRoot "global-project-cache-merge-$Stamp"
$LogPath = Join-Path $BackupDir "repair.log"
$LaunchLogPath = Join-Path $ProjectDir "opencode-global-project-cache-repair-launch.log"

function Write-Log {
  param([string]$Message)
  $line = "[$(Get-Date -Format o)] $Message"
  $line | Tee-Object -FilePath $LogPath -Append
}

function Assert-PathExists {
  param([string]$Path, [string]$Label)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Label not found: $Path"
  }
}

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
"[$(Get-Date -Format o)] Repair script entered. BackupDir=$BackupDir" | Set-Content -LiteralPath $LaunchLogPath -Encoding UTF8
Write-Log "OpenCode global project cache repair started."
Write-Log "This script will not terminate OpenCode. It waits until OpenCode.exe exits."

Assert-PathExists $DbPath "OpenCode SQLite DB"
Assert-PathExists $GlobalDatPath "OpenCode Desktop global dat"
Assert-PathExists $RepairScript "Repair generator script"
Assert-PathExists $AnalyzeScript "Analyzer script"

while (Get-Process -Name "OpenCode" -ErrorAction SilentlyContinue) {
  $count = @(Get-Process -Name "OpenCode" -ErrorAction SilentlyContinue).Count
  Write-Log "Waiting for OpenCode.exe to exit. Current process count: $count"
  Start-Sleep -Seconds 3
}

Write-Log "OpenCode.exe is not running. Creating backups."

$BackupFiles = @(
  $DbPath,
  "$DbPath-wal",
  "$DbPath-shm",
  $GlobalDatPath
)

foreach ($file in $BackupFiles) {
  if (Test-Path -LiteralPath $file) {
    Copy-Item -LiteralPath $file -Destination (Join-Path $BackupDir (Split-Path $file -Leaf)) -Force
    Write-Log "Backed up: $file"
  } else {
    Write-Log "Backup skipped, file absent: $file"
  }
}

$BeforeReport = Join-Path $BackupDir "before-analyze.json"
$AfterReport = Join-Path $BackupDir "after-analyze.json"
$GeneratedGlobalDat = Join-Path $BackupDir "opencode.global.dat.generated"
$GeneratorReport = Join-Path $BackupDir "generator-report.json"

Write-Log "Capturing before state."
& node $AnalyzeScript $DbPath $GlobalDatPath | Set-Content -LiteralPath $BeforeReport -Encoding UTF8

Write-Log "Generating merged global project cache into backup directory."
& node $RepairScript $DbPath $GlobalDatPath $GeneratedGlobalDat | Set-Content -LiteralPath $GeneratorReport -Encoding UTF8

Write-Log "Validating generated global dat JSON and expected counts."
$expectedGlobalSyncProjectsText = & node -e "const fs=require('fs'); const p=process.argv[1]; const raw=fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''); const report=JSON.parse(raw); console.log(String(report.counts.simulatedGlobalSyncProjects));" $GeneratorReport
$expectedGlobalSyncProjects = [int]$expectedGlobalSyncProjectsText.Trim()
$validationJson = & node -e "const fs=require('fs'); const p=process.argv[1]; const raw=fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''); const obj=JSON.parse(raw); const gs=JSON.parse(obj['globalSync.project']); console.log(JSON.stringify({topLevelKeys:Object.keys(obj).length, globalSyncProjects:gs.value.length}, null, 2));" $GeneratedGlobalDat
$validation = $validationJson | ConvertFrom-Json
if ($validation.globalSyncProjects -ne $expectedGlobalSyncProjects) {
  throw "Unexpected generated globalSync.project count: $($validation.globalSyncProjects). Expected $expectedGlobalSyncProjects from generator report."
}
Write-Log "Generated cache validated. globalSync.project count: $($validation.globalSyncProjects)."

Write-Log "Replacing opencode.global.dat with generated merged cache. SQLite DB is not modified."
Copy-Item -LiteralPath $GeneratedGlobalDat -Destination $GlobalDatPath -Force

Write-Log "Capturing after state."
& node $AnalyzeScript $DbPath $GlobalDatPath | Set-Content -LiteralPath $AfterReport -Encoding UTF8

$afterGlobalSyncProjectsText = & node -e "const fs=require('fs'); const p=process.argv[1]; const raw=fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''); const obj=JSON.parse(raw); const gs=JSON.parse(obj['globalSync.project']); console.log(String(gs.value.length));" $GlobalDatPath
$afterGlobalSyncProjects = [int]$afterGlobalSyncProjectsText.Trim()
if ($afterGlobalSyncProjects -ne $expectedGlobalSyncProjects) {
  throw "Post-repair globalSync.project count mismatch: $afterGlobalSyncProjects. Expected $expectedGlobalSyncProjects from generator report."
}

Write-Log "Repair completed successfully. Backup directory: $BackupDir"
Write-Log "You can reopen OpenCode Desktop now."
