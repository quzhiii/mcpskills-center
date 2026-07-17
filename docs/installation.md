# Installation

## Prerequisites

- Node.js 20 or Node.js 22-26 (Node.js 22 or 24 LTS recommended)
- npm 9 or later

## Install from source

```bash
git clone https://github.com/quzhiii/mcpskills-center.git
cd mcpskills-center
npm install
npm run build
```

Then use:

```bash
node dist/index.js init
node dist/index.js config validate
node dist/index.js doctor
node dist/index.js scan
node dist/index.js governance --dry-run
```

## Global install (npm)

```bash
npm install -g mcpskills-center
```

Then use directly:

```bash
mcpskills init
mcpskills config validate
mcpskills doctor
mcpskills scan
mcpskills governance --dry-run
mcpskills route "fix this bug"
```

## Local install (npx)

```bash
npx mcpskills-center scan
```

## Verify installation

```bash
mcpskills help
mcpskills init --dry-run
mcpskills config path
mcpskills config validate
mcpskills doctor
mcpskills scan
```

## User configuration and data

MCPskills Center keeps writable state outside the installed npm package:

| Platform | User data root |
|---|---|
| Windows | `%APPDATA%\mcpskills-center\` |
| macOS | `~/Library/Application Support/mcpskills-center/` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/mcpskills-center/` |

`mcpskills init` creates editable config under `<user-data-root>/config/` and skips existing files. `mcpskills init --force --confirm` overwrites only known MCPskills Center config files. Reports, backups, canonical skills, and SQLite data use sibling directories under the same root.

The repository currently contains the 0.3.0 source milestone. It has not been published to npm; npm `latest` remains 0.2.2.

If `mcpskills` is not found after global install, check that your npm global bin directory is in your PATH:

```bash
npm config get prefix
# Add <prefix>/bin to your PATH if needed
```

## Uninstall

```bash
npm uninstall -g mcpskills-center
```
