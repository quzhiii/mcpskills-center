const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const home = process.env.USERPROFILE || process.env.HOME;
if (!home) throw new Error("USERPROFILE/HOME is not set.");

const desktopDir = path.join(home, "AppData", "Roaming", "ai.opencode.desktop");
const configPath = path.join(home, ".config", "opencode", "opencode.json");
const globalDatPath = path.join(desktopDir, "opencode.global.dat");
const badProvider = "aiclient2api-kiro";
const defaultPort = 3000;
const defaultModels = ["claude-opus-4-6", "claude-sonnet-4-6", "claude-opus-4-7"];

function parseArgs(argv) {
  const args = { command: argv[2] || "status", port: defaultPort, select: false, requireHealthy: true };
  for (let i = 3; i < argv.length; i++) {
    const item = argv[i];
    if (item === "--port") args.port = Number(argv[++i]);
    else if (item === "--base-url") args.baseUrl = argv[++i];
    else if (item === "--model") args.model = argv[++i];
    else if (item === "--select") args.select = true;
    else if (item === "--no-health-check") args.requireHealthy = false;
    else throw new Error(`Unknown argument: ${item}`);
  }
  if (!Number.isInteger(args.port) || args.port <= 0 || args.port > 65535) {
    throw new Error(`Invalid port: ${args.port}`);
  }
  return args;
}

function baseUrlFromArgs(args) {
  return args.baseUrl || `http://127.0.0.1:${args.port}/claude-kiro-oauth/v1`;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return {
    raw,
    json: JSON.parse(raw.replace(/^\uFEFF/, "")),
    hadBom: raw.charCodeAt(0) === 0xfeff,
  };
}

function writeJson(filePath, json, hadBom = false) {
  const text = JSON.stringify(json, null, 2) + "\n";
  fs.writeFileSync(filePath, (hadBom ? "\uFEFF" : "") + text, "utf8");
}

function backupFiles(files) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  const backupDir = path.join(desktopDir, "repair-backups", `kiro-provider-toggle-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  for (const file of files) {
    if (fs.existsSync(file)) fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
  }
  return backupDir;
}

function parseNestedJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "string") return JSON.parse(value);
  return value;
}

function stringifyLikeOriginal(original, value) {
  return typeof original === "string" ? JSON.stringify(value) : value;
}

function probe(baseUrl) {
  const url = new URL(baseUrl);
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname.replace(/\/$/, "") + "/models",
        method: "GET",
        timeout: 2500,
      },
      (res) => {
        res.resume();
        resolve({ reachable: true, statusCode: res.statusCode });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ reachable: false, error: "TIMEOUT" });
    });
    req.on("error", (error) => resolve({ reachable: false, error: error.code || error.message }));
    req.end();
  });
}

function readState() {
  const config = readJson(configPath);
  const global = readJson(globalDatPath);
  const modelState = parseNestedJson(global.json.model, { user: [], recent: [], variant: {} });
  const provider = config.json.provider?.[badProvider];
  return { config, global, modelState, provider };
}

function writeState(config, global, modelState) {
  global.json.model = stringifyLikeOriginal(global.json.model, modelState);
  writeJson(configPath, config.json, config.hadBom);
  writeJson(globalDatPath, global.json, global.hadBom);
}

function setDisabled(configJson, disabled) {
  if (!Array.isArray(configJson.disabled_providers)) configJson.disabled_providers = [];
  const before = configJson.disabled_providers.length;
  configJson.disabled_providers = disabled
    ? [...new Set([...configJson.disabled_providers, badProvider])]
    : configJson.disabled_providers.filter((item) => item !== badProvider);
  return before !== configJson.disabled_providers.length;
}

function setModelVisibility(modelState, visibility) {
  let changes = 0;
  for (const modelID of defaultModels) {
    let entry = modelState.user?.find((item) => item.providerID === badProvider && item.modelID === modelID);
    if (!entry) {
      entry = { providerID: badProvider, modelID, visibility };
      if (!Array.isArray(modelState.user)) modelState.user = [];
      modelState.user.push(entry);
      changes++;
    } else if (entry.visibility !== visibility) {
      entry.visibility = visibility;
      changes++;
    }
  }
  return changes;
}

function removeRecentKiro(modelState) {
  if (!Array.isArray(modelState.recent)) return 0;
  const before = modelState.recent.length;
  modelState.recent = modelState.recent.filter((item) => item.providerID !== badProvider);
  return before - modelState.recent.length;
}

function selectModel(modelState, modelID) {
  const chosen = { providerID: badProvider, modelID };
  if (!Array.isArray(modelState.recent)) modelState.recent = [];
  modelState.recent = modelState.recent.filter(
    (item) => !(item.providerID === chosen.providerID && item.modelID === chosen.modelID),
  );
  modelState.recent.unshift(chosen);
  if (!modelState.variant || typeof modelState.variant !== "object") modelState.variant = {};
  modelState.variant[`${badProvider}/${modelID}`] = modelID.includes("opus") ? "max" : "high";
}

async function main() {
  const args = parseArgs(process.argv);
  const baseUrl = baseUrlFromArgs(args);
  const state = readState();
  const health = await probe(baseUrl);
  const selectedModel = args.model || defaultModels[0];

  if (!defaultModels.includes(selectedModel)) {
    throw new Error(`Unsupported Kiro model '${selectedModel}'. Use one of: ${defaultModels.join(", ")}`);
  }

  if (args.command === "status") {
    console.log(JSON.stringify({
      provider: badProvider,
      configuredBaseUrl: state.provider?.options?.baseURL,
      requestedBaseUrl: baseUrl,
      disabled: state.config.json.disabled_providers?.includes(badProvider) || false,
      visibleModels: state.modelState.user?.filter((item) => item.providerID === badProvider),
      recentModels: state.modelState.recent?.slice(0, 5),
      health,
    }, null, 2));
    return;
  }

  if (args.command !== "enable" && args.command !== "disable") {
    throw new Error("Command must be one of: status, enable, disable");
  }

  if (args.command === "enable" && args.requireHealthy && !health.reachable) {
    console.log(JSON.stringify({
      ok: false,
      reason: "Kiro proxy is not reachable; leaving provider disabled to avoid OpenCode sidecar crashes.",
      baseUrl,
      health,
      hint: "Start AIClient2API on the configured port, or rerun with --port/--base-url. Use --no-health-check only if you know the proxy will be up before OpenCode sends a request.",
    }, null, 2));
    process.exitCode = 2;
    return;
  }

  const backupDir = backupFiles([configPath, globalDatPath]);
  let changes = 0;
  if (!state.provider) throw new Error(`Provider '${badProvider}' is missing from ${configPath}`);
  state.provider.options = state.provider.options || {};
  if (state.provider.options.baseURL !== baseUrl) {
    state.provider.options.baseURL = baseUrl;
    changes++;
  }

  if (args.command === "enable") {
    if (setDisabled(state.config.json, false)) changes++;
    changes += setModelVisibility(state.modelState, "show");
    if (args.select) selectModel(state.modelState, selectedModel);
  } else {
    if (setDisabled(state.config.json, true)) changes++;
    changes += setModelVisibility(state.modelState, "hide");
    changes += removeRecentKiro(state.modelState);
  }

  writeState(state.config, state.global, state.modelState);
  console.log(JSON.stringify({
    ok: true,
    command: args.command,
    provider: badProvider,
    baseUrl,
    selectedModel: args.select ? selectedModel : null,
    changes,
    backupDir,
    health,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
