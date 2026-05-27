<#
.SYNOPSIS
  Switch Codex between configured API providers without storing API keys in config.toml.

.EXAMPLES
  powershell -NoProfile -ExecutionPolicy Bypass -File .\switch-codex-route.ps1 status
  powershell -NoProfile -ExecutionPolicy Bypass -File .\switch-codex-route.ps1 api
  powershell -NoProfile -ExecutionPolicy Bypass -File .\switch-codex-route.ps1 official
  powershell -NoProfile -ExecutionPolicy Bypass -File .\switch-codex-route.ps1 use -Provider codex_0vo

  powershell -NoProfile -ExecutionPolicy Bypass -File .\switch-codex-route.ps1 add-api `
    -Provider my_api -Name "My API" -BaseUrl "https://api.example.com/v1" -EnvKey CODEX_MY_API_KEY

  powershell -NoProfile -ExecutionPolicy Bypass -File .\switch-codex-route.ps1 set-key `
    -Provider my_api
#>

[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("status", "list", "api", "0vo", "official", "plus", "use", "add-api", "set-key")]
  [string]$Command = "status",

  [string]$Provider,
  [string]$Name,
  [string]$BaseUrl,
  [string]$Model,
  [string]$Reasoning,
  [string]$WireApi = "responses",
  [string]$EnvKey,
  [string]$ApiKey,

  [switch]$SetUserEnv,
  [switch]$NoSwitch,
  [switch]$NoBackup,
  [switch]$DryRun,

  [string]$ConfigPath = (Join-Path $env:USERPROFILE ".codex\config.toml"),
  [string]$AuthPath = (Join-Path $env:USERPROFILE ".codex\auth.json")
)

$ErrorActionPreference = "Stop"
$ValidReasoning = @("minimal", "low", "medium", "high", "xhigh")

function ConvertTo-TomlString {
  param([AllowNull()][string]$Value)

  if ($null -eq $Value) {
    return '""'
  }

  $escaped = $Value.Replace('\', '\\').Replace('"', '\"')
  return '"' + $escaped + '"'
}

function Assert-ProviderId {
  param([string]$Id)

  if ([string]::IsNullOrWhiteSpace($Id)) {
    throw "Provider id is required."
  }
  if ($Id -notmatch '^[A-Za-z0-9_-]+$') {
    throw "Provider id '$Id' is invalid. Use only letters, numbers, underscore, or hyphen."
  }
}

function Assert-Reasoning {
  param([AllowNull()][string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return
  }
  if ($ValidReasoning -notcontains $Value) {
    throw "Invalid reasoning '$Value'. Use one of: $($ValidReasoning -join ', ')."
  }
}

function Get-ConfigText {
  if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Config not found: $ConfigPath"
  }

  return [System.IO.File]::ReadAllText($ConfigPath, [System.Text.Encoding]::UTF8)
}

function Write-ConfigText {
  param([string]$Text)

  if ($DryRun) {
    Write-Output "Dry run: config was not written."
    return
  }

  $dir = Split-Path -Parent $ConfigPath
  if (-not (Test-Path -LiteralPath $dir)) {
    throw "Config directory not found: $dir"
  }

  $tmpPath = Join-Path $dir (".$([System.IO.Path]::GetFileName($ConfigPath)).tmp-$PID-$([guid]::NewGuid().ToString('N'))")
  $encoding = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($tmpPath, $Text, $encoding)

  try {
    Move-Item -LiteralPath $tmpPath -Destination $ConfigPath -Force
  } catch {
    Remove-Item -LiteralPath $tmpPath -Force -ErrorAction SilentlyContinue
    throw
  }
}

function Backup-Config {
  if ($NoBackup -or $DryRun) {
    return $null
  }

  $backupPath = "$ConfigPath.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Copy-Item -LiteralPath $ConfigPath -Destination $backupPath -Force
  return $backupPath
}

function New-LineList {
  param([string]$Text)

  $lines = [System.Collections.Generic.List[string]]::new()
  foreach ($line in ($Text -split "`r?`n")) {
    $lines.Add($line)
  }
  return ,$lines
}

function Join-Lines {
  param([System.Collections.Generic.List[string]]$Lines)

  return ($Lines -join "`r`n").TrimEnd() + "`r`n"
}

function Get-TopLevelValue {
  param(
    [string]$Text,
    [string]$Key
  )

  $lines = $Text -split "`r?`n"
  $pattern = "^\s*$([regex]::Escape($Key))\s*=\s*`"([^`"]*)`"\s*$"

  foreach ($line in $lines) {
    if ($line -match '^\s*\[') {
      break
    }
    if ($line -match $pattern) {
      return $Matches[1]
    }
  }

  return $null
}

function Set-Or-InsertTopLevelValue {
  param(
    [string]$Text,
    [string]$Key,
    [string]$Value
  )

  $lines = New-LineList -Text $Text
  $sectionStart = $lines.Count
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s*\[') {
      $sectionStart = $i
      break
    }
  }

  $keyPattern = "^\s*$([regex]::Escape($Key))\s*="
  for ($i = 0; $i -lt $sectionStart; $i++) {
    if ($lines[$i] -match $keyPattern) {
      $lines[$i] = "$Key = $Value"
      return (Join-Lines -Lines $lines)
    }
  }

  $lines.Insert($sectionStart, "$Key = $Value")
  if ($sectionStart -lt $lines.Count - 1 -and $lines[$sectionStart + 1] -ne "") {
    $lines.Insert($sectionStart + 1, "")
  }

  return (Join-Lines -Lines $lines)
}

function Remove-TopLevelValue {
  param(
    [string]$Text,
    [string]$Key
  )

  $lines = New-LineList -Text $Text
  $sectionStart = $lines.Count
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s*\[') {
      $sectionStart = $i
      break
    }
  }

  $keyPattern = "^\s*$([regex]::Escape($Key))\s*="
  for ($i = 0; $i -lt $sectionStart; $i++) {
    if ($lines[$i] -match $keyPattern) {
      $lines.RemoveAt($i)
      break
    }
  }

  return (Join-Lines -Lines $lines)
}

function Get-SectionRange {
  param(
    [System.Collections.Generic.List[string]]$Lines,
    [string]$Section
  )

  $headerPattern = "^\s*\[$([regex]::Escape($Section))\]\s*$"
  for ($i = 0; $i -lt $Lines.Count; $i++) {
    if ($Lines[$i] -match $headerPattern) {
      $end = $Lines.Count
      for ($j = $i + 1; $j -lt $Lines.Count; $j++) {
        if ($Lines[$j] -match '^\s*\[') {
          $end = $j
          break
        }
      }
      return [PSCustomObject]@{ Start = $i; End = $end }
    }
  }

  return $null
}

function Set-SectionValue {
  param(
    [string]$Text,
    [string]$Section,
    [string]$Key,
    [string]$Value
  )

  $lines = New-LineList -Text $Text
  $range = Get-SectionRange -Lines $lines -Section $Section

  if ($null -eq $range) {
    if ($lines.Count -gt 0 -and $lines[$lines.Count - 1] -ne "") {
      $lines.Add("")
    }
    $lines.Add("[$Section]")
    $lines.Add("$Key = $Value")
    return (Join-Lines -Lines $lines)
  }

  $keyPattern = "^\s*$([regex]::Escape($Key))\s*="
  for ($i = $range.Start + 1; $i -lt $range.End; $i++) {
    if ($lines[$i] -match $keyPattern) {
      $lines[$i] = "$Key = $Value"
      return (Join-Lines -Lines $lines)
    }
  }

  $lines.Insert($range.End, "$Key = $Value")
  return (Join-Lines -Lines $lines)
}

function Get-SectionStringValue {
  param(
    [string]$Body,
    [string]$Key
  )

  $pattern = "(?m)^\s*$([regex]::Escape($Key))\s*=\s*`"([^`"]*)`"\s*$"
  $match = [regex]::Match($Body, $pattern)
  if ($match.Success) {
    return $match.Groups[1].Value
  }

  return $null
}

function Get-ProviderInfos {
  param([string]$Text)

  $matches = [regex]::Matches($Text, '(?ms)^\s*\[model_providers\.([A-Za-z0-9_-]+)\]\s*(.*?)(?=^\s*\[|\z)')
  foreach ($match in $matches) {
    $id = $match.Groups[1].Value
    $body = $match.Groups[2].Value
    [PSCustomObject]@{
      Id      = $id
      Name    = Get-SectionStringValue -Body $body -Key "name"
      BaseUrl = Get-SectionStringValue -Body $body -Key "base_url"
      EnvKey  = Get-SectionStringValue -Body $body -Key "env_key"
      WireApi = Get-SectionStringValue -Body $body -Key "wire_api"
    }
  }
}

function Get-ProviderInfo {
  param(
    [string]$Text,
    [string]$Id
  )

  @(Get-ProviderInfos -Text $Text) | Where-Object { $_.Id -eq $Id } | Select-Object -First 1
}

function Test-ProviderExists {
  param(
    [string]$Text,
    [string]$Id
  )

  if ($Id -eq "openai") {
    return $true
  }

  return $null -ne (Get-ProviderInfo -Text $Text -Id $Id)
}

function Get-EnvSummary {
  param([AllowNull()][string]$VariableName)

  if ([string]::IsNullOrWhiteSpace($VariableName)) {
    return "not used"
  }

  $parts = @()
  foreach ($scope in @("Process", "User", "Machine")) {
    $value = [Environment]::GetEnvironmentVariable($VariableName, $scope)
    if (-not [string]::IsNullOrEmpty($value)) {
      $parts += "${scope}:$($value.Length) chars"
    }
  }

  if ($parts.Count -eq 0) {
    return "missing"
  }

  return ($parts -join ", ")
}

function Get-AuthModeText {
  if (-not (Test-Path -LiteralPath $AuthPath)) {
    return "Auth: no auth.json (env_key API providers can still work)"
  }

  try {
    $auth = Get-Content -LiteralPath $AuthPath -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    return "Auth: unreadable auth.json"
  }

  if (($null -ne $auth.OPENAI_API_KEY -and $auth.OPENAI_API_KEY -ne "") -or
      ($null -ne $auth.api_key -and $auth.api_key -ne "")) {
    return "Auth: API key file"
  }

  if ($null -ne $auth.tokens -or $null -ne $auth.access_token -or $null -ne $auth.refresh_token) {
    return "Auth: account login"
  }

  return "Auth: auth.json present"
}

function Save-ApiKeyToUserEnv {
  param(
    [string]$VariableName,
    [AllowNull()][string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($VariableName)) {
    throw "EnvKey is required before saving an API key."
  }

  if ([string]::IsNullOrEmpty($Value)) {
    $secure = Read-Host "Enter API key for $VariableName" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
      $Value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "API key cannot be empty."
  }

  [Environment]::SetEnvironmentVariable($VariableName, $Value, "User")
  [Environment]::SetEnvironmentVariable($VariableName, $Value, "Process")
  Set-Item -LiteralPath "Env:$VariableName" -Value $Value
}

function Get-DefaultModel {
  param([string]$Text)

  $value = Get-TopLevelValue -Text $Text -Key "model"
  if ([string]::IsNullOrWhiteSpace($value)) {
    return "gpt-5.5"
  }
  return $value
}

function Get-DefaultReasoning {
  param([string]$Text)

  $value = Get-TopLevelValue -Text $Text -Key "model_reasoning_effort"
  if ([string]::IsNullOrWhiteSpace($value)) {
    return "xhigh"
  }
  return $value
}

function Set-CodexDefaultProvider {
  param(
    [string]$Text,
    [string]$ProviderId,
    [string]$ModelName,
    [string]$ReasoningEffort
  )

  if (-not (Test-ProviderExists -Text $Text -Id $ProviderId)) {
    throw "Provider '$ProviderId' is not defined in $ConfigPath. Use 'add-api' first, or check the provider id."
  }

  if ([string]::IsNullOrWhiteSpace($ModelName)) {
    $ModelName = Get-DefaultModel -Text $Text
  }
  if ([string]::IsNullOrWhiteSpace($ReasoningEffort)) {
    $ReasoningEffort = Get-DefaultReasoning -Text $Text
  }
  Assert-Reasoning -Value $ReasoningEffort

  $Text = Set-Or-InsertTopLevelValue -Text $Text -Key "model_provider" -Value (ConvertTo-TomlString $ProviderId)
  $Text = Set-Or-InsertTopLevelValue -Text $Text -Key "model" -Value (ConvertTo-TomlString $ModelName)
  $Text = Set-Or-InsertTopLevelValue -Text $Text -Key "model_reasoning_effort" -Value (ConvertTo-TomlString $ReasoningEffort)

  # These were written by an older local switch script and can accidentally affect later routes.
  $Text = Remove-TopLevelValue -Text $Text -Key "service_tier"
  $Text = Remove-TopLevelValue -Text $Text -Key "personality"

  return $Text
}

function Add-Or-UpdateApiProvider {
  param(
    [string]$Text,
    [string]$ProviderId,
    [string]$ProviderName,
    [string]$Endpoint,
    [string]$EnvironmentVariable,
    [string]$ModelName,
    [string]$ReasoningEffort,
    [string]$ApiFormat
  )

  Assert-ProviderId -Id $ProviderId
  if ([string]::IsNullOrWhiteSpace($ProviderName)) {
    $ProviderName = $ProviderId
  }
  if ([string]::IsNullOrWhiteSpace($Endpoint)) {
    throw "BaseUrl is required for add-api."
  }
  if ([string]::IsNullOrWhiteSpace($EnvironmentVariable)) {
    $EnvironmentVariable = "CODEX_$($ProviderId.ToUpperInvariant().Replace('-', '_'))_API_KEY"
  }
  if ([string]::IsNullOrWhiteSpace($ModelName)) {
    $ModelName = "gpt-5.5"
  }
  if ([string]::IsNullOrWhiteSpace($ReasoningEffort)) {
    $ReasoningEffort = "xhigh"
  }
  Assert-Reasoning -Value $ReasoningEffort
  if ([string]::IsNullOrWhiteSpace($ApiFormat)) {
    $ApiFormat = "responses"
  }

  $providerSection = "model_providers.$ProviderId"
  $Text = Set-SectionValue -Text $Text -Section $providerSection -Key "name" -Value (ConvertTo-TomlString $ProviderName)
  $Text = Set-SectionValue -Text $Text -Section $providerSection -Key "base_url" -Value (ConvertTo-TomlString $Endpoint)
  $Text = Set-SectionValue -Text $Text -Section $providerSection -Key "env_key" -Value (ConvertTo-TomlString $EnvironmentVariable)
  $Text = Set-SectionValue -Text $Text -Section $providerSection -Key "wire_api" -Value (ConvertTo-TomlString $ApiFormat)

  $profileSection = "profiles.$ProviderId"
  $Text = Set-SectionValue -Text $Text -Section $profileSection -Key "model_provider" -Value (ConvertTo-TomlString $ProviderId)
  $Text = Set-SectionValue -Text $Text -Section $profileSection -Key "model" -Value (ConvertTo-TomlString $ModelName)
  $Text = Set-SectionValue -Text $Text -Section $profileSection -Key "model_reasoning_effort" -Value (ConvertTo-TomlString $ReasoningEffort)

  if (-not $NoSwitch) {
    $Text = Set-CodexDefaultProvider -Text $Text -ProviderId $ProviderId -ModelName $ModelName -ReasoningEffort $ReasoningEffort
  }

  return [PSCustomObject]@{
    Text   = $Text
    EnvKey = $EnvironmentVariable
  }
}

function Show-Status {
  param([AllowNull()][string]$Text)

  if ([string]::IsNullOrEmpty($Text)) {
    $Text = Get-ConfigText
  }

  $currentProvider = Get-TopLevelValue -Text $Text -Key "model_provider"
  $currentModel = Get-TopLevelValue -Text $Text -Key "model"
  $currentReasoning = Get-TopLevelValue -Text $Text -Key "model_reasoning_effort"

  Write-Output "Config: $ConfigPath"
  Write-Output "Default provider: $currentProvider"
  if ($currentModel) {
    Write-Output "Model: $currentModel"
  }
  if ($currentReasoning) {
    Write-Output "Reasoning: $currentReasoning"
  }
  Write-Output (Get-AuthModeText)
  Write-Output ""
  Write-Output "Providers:"

  $providers = @(Get-ProviderInfos -Text $Text)
  if ($providers.Count -eq 0) {
    Write-Output "  (none defined; built-in openai may still work)"
    return
  }

  foreach ($providerInfo in $providers) {
    $marker = if ($providerInfo.Id -eq $currentProvider) { "*" } else { " " }
    $envStatus = Get-EnvSummary -VariableName $providerInfo.EnvKey
    Write-Output ("{0} {1}  name={2}  wire={3}" -f $marker, $providerInfo.Id, $providerInfo.Name, $providerInfo.WireApi)
    Write-Output ("    base_url={0}" -f $providerInfo.BaseUrl)
    Write-Output ("    env_key={0} ({1})" -f $providerInfo.EnvKey, $envStatus)
  }
}

if ($Command -eq "list" -or $Command -eq "status") {
  Show-Status
  exit 0
}

$content = Get-ConfigText
$targetProvider = $Provider
$changedDefaultProvider = $true
$backupPath = $null
$warnings = @()

switch ($Command) {
  "api" {
    $targetProvider = "codex_0vo"
    $content = Set-CodexDefaultProvider -Text $content -ProviderId $targetProvider -ModelName $Model -ReasoningEffort $Reasoning
  }
  "0vo" {
    $targetProvider = "codex_0vo"
    $content = Set-CodexDefaultProvider -Text $content -ProviderId $targetProvider -ModelName $Model -ReasoningEffort $Reasoning
  }
  "official" {
    $targetProvider = "openai"
    if ([string]::IsNullOrWhiteSpace($Reasoning)) {
      $Reasoning = "xhigh"
    }
    $content = Set-CodexDefaultProvider -Text $content -ProviderId $targetProvider -ModelName $Model -ReasoningEffort $Reasoning
  }
  "plus" {
    $targetProvider = "openai"
    if ([string]::IsNullOrWhiteSpace($Reasoning)) {
      $Reasoning = "xhigh"
    }
    $content = Set-CodexDefaultProvider -Text $content -ProviderId $targetProvider -ModelName $Model -ReasoningEffort $Reasoning
  }
  "use" {
    Assert-ProviderId -Id $targetProvider
    $content = Set-CodexDefaultProvider -Text $content -ProviderId $targetProvider -ModelName $Model -ReasoningEffort $Reasoning
  }
  "add-api" {
    $result = Add-Or-UpdateApiProvider `
      -Text $content `
      -ProviderId $targetProvider `
      -ProviderName $Name `
      -Endpoint $BaseUrl `
      -EnvironmentVariable $EnvKey `
      -ModelName $Model `
      -ReasoningEffort $Reasoning `
      -ApiFormat $WireApi

    $content = $result.Text
    $EnvKey = $result.EnvKey
    $changedDefaultProvider = -not $NoSwitch
    if ($SetUserEnv -or -not [string]::IsNullOrEmpty($ApiKey)) {
      Save-ApiKeyToUserEnv -VariableName $EnvKey -Value $ApiKey
    } else {
      $warnings += "API key not stored. Run: .\switch-codex-route.ps1 set-key -Provider $targetProvider"
    }
  }
  "set-key" {
    if ([string]::IsNullOrWhiteSpace($EnvKey)) {
      if ([string]::IsNullOrWhiteSpace($targetProvider)) {
        $targetProvider = Get-TopLevelValue -Text $content -Key "model_provider"
      }
      $providerInfo = Get-ProviderInfo -Text $content -Id $targetProvider
      if ($null -eq $providerInfo -or [string]::IsNullOrWhiteSpace($providerInfo.EnvKey)) {
        throw "Could not infer EnvKey for provider '$targetProvider'. Pass -EnvKey explicitly."
      }
      $EnvKey = $providerInfo.EnvKey
    }

    Save-ApiKeyToUserEnv -VariableName $EnvKey -Value $ApiKey
    Write-Output "Saved $EnvKey to the User environment and this process. Restart terminals/Codex for already-running apps."
    exit 0
  }
}

$backupPath = Backup-Config
Write-ConfigText -Text $content

if ($changedDefaultProvider) {
  Write-Output "Updated Codex default provider: $targetProvider"
} else {
  Write-Output "Updated provider definition: $targetProvider"
}
if ($backupPath) {
  Write-Output "Backup: $backupPath"
}
Write-Output ""
Show-Status -Text $content

if ($warnings.Count -gt 0) {
  Write-Output ""
  foreach ($warning in $warnings) {
    Write-Output "Warning: $warning"
  }
}

$providerAfter = Get-ProviderInfo -Text $content -Id $targetProvider
if ($null -ne $providerAfter -and -not [string]::IsNullOrWhiteSpace($providerAfter.EnvKey)) {
  $summary = Get-EnvSummary -VariableName $providerAfter.EnvKey
  if ($summary -eq "missing") {
    Write-Output ""
    Write-Output "Warning: $($providerAfter.EnvKey) is not set. Use 'set-key' before starting a new Codex session."
  }
}

if ($targetProvider -eq "openai") {
  Write-Output ""
  Write-Output "Official OpenAI route uses Codex account login. If needed, run: codex logout ; codex login --device-auth"
}
