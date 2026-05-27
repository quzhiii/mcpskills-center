const fs = require("node:fs");
const path = require("node:path");

const home = process.env.USERPROFILE || process.env.HOME;
if (!home) throw new Error("USERPROFILE/HOME is not set.");

const timestamp = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\..+/, "")
  .replace("T", "-");

const desktopDir = path.join(home, "AppData", "Roaming", "ai.opencode.desktop");
const configPath = path.join(home, ".config", "opencode", "opencode.json");
const globalDatPath = path.join(desktopDir, "opencode.global.dat");
const backupDir = path.join(desktopDir, "repair-backups", `kiro-provider-stability-${timestamp}`);

const badProvider = "aiclient2api-kiro";
const fallbackModel = { providerID: "xy94", modelID: "gpt-5.5" };
const fallbackVariant = "xhigh";

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return {
    raw,
    json: JSON.parse(raw.replace(/^\uFEFF/, "")),
    hadBom: raw.charCodeAt(0) === 0xfeff,
  };
}

function writeJsonFile(filePath, json, hadBom = false) {
  const text = JSON.stringify(json, null, 2) + "\n";
  fs.writeFileSync(filePath, (hadBom ? "\uFEFF" : "") + text, "utf8");
}

function copyBackup(filePath) {
  if (!fs.existsSync(filePath)) return false;
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(filePath, path.join(backupDir, path.basename(filePath)));
  return true;
}

function parseNestedJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "string") return JSON.parse(value);
  return value;
}

function stringifyLikeOriginal(original, value) {
  return typeof original === "string" ? JSON.stringify(value) : value;
}

function replaceBadSelection(selection) {
  if (!selection || typeof selection !== "object") return false;
  if (selection.model?.providerID !== badProvider) return false;
  selection.model = { ...fallbackModel };
  selection.variant = fallbackVariant;
  return true;
}

function sanitizeModelState(globalState) {
  const original = globalState.model;
  const model = parseNestedJson(original, { user: [], recent: [], variant: {} });
  let changes = 0;

  if (Array.isArray(model.user)) {
    for (const entry of model.user) {
      if (entry.providerID === badProvider && entry.visibility !== "hide") {
        entry.visibility = "hide";
        changes++;
      }
    }
  }

  if (Array.isArray(model.recent)) {
    const before = model.recent.length;
    model.recent = model.recent.filter((entry) => entry.providerID !== badProvider);
    changes += before - model.recent.length;
    if (!model.recent.some((entry) => entry.providerID === fallbackModel.providerID && entry.modelID === fallbackModel.modelID)) {
      model.recent.unshift({ ...fallbackModel });
      changes++;
    }
  }

  if (model.variant && typeof model.variant === "object") {
    for (const key of Object.keys(model.variant)) {
      if (key.startsWith(`${badProvider}/`)) {
        delete model.variant[key];
        changes++;
      }
    }
    const fallbackKey = `${fallbackModel.providerID}/${fallbackModel.modelID}`;
    if (!model.variant[fallbackKey]) {
      model.variant[fallbackKey] = fallbackVariant;
      changes++;
    }
  }

  if (changes > 0) globalState.model = stringifyLikeOriginal(original, model);
  return changes;
}

function sanitizeWorkspaceState(filePath) {
  const { json, hadBom } = readJsonFile(filePath);
  let changes = 0;
  const key = "workspace:model-selection";
  if (json[key]) {
    const original = json[key];
    const selection = parseNestedJson(original, { session: {} });
    for (const sessionSelection of Object.values(selection.session || {})) {
      if (replaceBadSelection(sessionSelection)) changes++;
    }
    if (changes > 0) json[key] = stringifyLikeOriginal(original, selection);
  }
  if (changes > 0) writeJsonFile(filePath, json, hadBom);
  return changes;
}

function sanitizeConfig() {
  const { json, hadBom } = readJsonFile(configPath);
  let changes = 0;
  if (!Array.isArray(json.disabled_providers)) json.disabled_providers = [];
  if (!json.disabled_providers.includes(badProvider)) {
    json.disabled_providers.push(badProvider);
    changes++;
  }
  if (changes > 0) writeJsonFile(configPath, json, hadBom);
  return changes;
}

function findWorkspaceFilesWithBadProvider() {
  return fs
    .readdirSync(desktopDir)
    .filter((name) => name.startsWith("opencode.workspace.") && name.endsWith(".dat"))
    .map((name) => path.join(desktopDir, name))
    .filter((filePath) => fs.readFileSync(filePath, "utf8").includes(badProvider));
}

copyBackup(configPath);
copyBackup(globalDatPath);

const workspaceFiles = findWorkspaceFilesWithBadProvider();
for (const filePath of workspaceFiles) copyBackup(filePath);

const configChanges = sanitizeConfig();

const globalData = readJsonFile(globalDatPath);
const globalChanges = sanitizeModelState(globalData.json);
if (globalChanges > 0) writeJsonFile(globalDatPath, globalData.json, globalData.hadBom);

const workspaceChanges = [];
for (const filePath of workspaceFiles) {
  const changes = sanitizeWorkspaceState(filePath);
  if (changes > 0) workspaceChanges.push({ file: path.basename(filePath), changes });
}

console.log(JSON.stringify({
  backupDir,
  configChanges,
  globalChanges,
  workspaceFilesScanned: workspaceFiles.length,
  workspaceChanges,
  fallbackModel,
  fallbackVariant,
}, null, 2));
