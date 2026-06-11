# Installation

## Prerequisites

- Node.js 18 or later
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
node dist/index.js scan
node dist/index.js governance --dry-run
```

## Global install (npm)

```bash
npm install -g mcpskills-center
```

Then use directly:

```bash
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
mcpskills scan
```

If `mcpskills` is not found after global install, check that your npm global bin directory is in your PATH:

```bash
npm config get prefix
# Add <prefix>/bin to your PATH if needed
```

## Uninstall

```bash
npm uninstall -g mcpskills-center
```
