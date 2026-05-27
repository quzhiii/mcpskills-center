# Codex API Switching

This folder contains a small local switcher for Codex API routes:

- `switch-codex-route.ps1` is the main tool.
- `use-codex-api.ps1` switches back to the configured `codex_0vo` API provider.
- `use-codex-plus.ps1` switches to the built-in `openai` provider for official account login.

The switcher edits only `C:\Users\quzhi\.codex\config.toml` and creates a timestamped backup before writing. API keys are not written to the TOML file; providers point to an environment variable such as `CODEX_0VO_API_KEY`.

## Common Commands

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\switch-codex-route.ps1 status
powershell -NoProfile -ExecutionPolicy Bypass -File .\switch-codex-route.ps1 api
powershell -NoProfile -ExecutionPolicy Bypass -File .\switch-codex-route.ps1 official
```

Add a new OpenAI-compatible API route:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\switch-codex-route.ps1 add-api `
  -Provider my_api `
  -Name "My API" `
  -BaseUrl "https://api.example.com/v1" `
  -EnvKey CODEX_MY_API_KEY `
  -SetUserEnv
```

Switch to that provider later:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\switch-codex-route.ps1 use -Provider my_api
```

Set or rotate the key for a provider:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\switch-codex-route.ps1 set-key -Provider my_api
```

Restart already-running Codex sessions after switching routes. New sessions read the updated default provider.
