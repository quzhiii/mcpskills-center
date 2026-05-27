const fs = require("node:fs");
const path = require("node:path");

const home = process.env.USERPROFILE || process.env.HOME;
if (!home) throw new Error("USERPROFILE/HOME is not set.");

const mainConfigPath = path.join(home, ".config", "opencode", "opencode.json");
const secondaryConfigPath = path.join(home, ".opencode", "opencode.json");
const localPluginPath = path.join(home, ".config", "opencode", "plugins", "trg-observer.mjs");
const ohMyPlugin = "oh-my-openagent@latest";

const modes = {
  stable: [localPluginPath],
  "local-only": [localPluginPath],
  "enable-ohmy": [localPluginPath, ohMyPlugin],
  "ohmy-only": [ohMyPlugin],
  "disable-all": [],
};

function parseArgs(argv) {
  const command = argv[2] || "status";
  const args = { command, restartHint: true };
  for (let i = 3; i < argv.length; i++) {
    const item = argv[i];
    if (item === "--no-restart-hint") args.restartHint = false;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return {
    raw,
    json: JSON.parse(raw.replace(/^\uFEFF/, "")),
    hadBom: raw.charCodeAt(0) === 0xfeff,
  };
}

function writeJson(filePath, data) {
  const text = JSON.stringify(data.json, null, 2) + "\n";
  fs.writeFileSync(filePath, (data.hadBom ? "\uFEFF" : "") + text, "utf8");
}

function backupFiles(files, label) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const backupDir = path.join(home, ".config", "opencode", "backups", `${label}-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  for (const filePath of files) {
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, path.join(backupDir, path.basename(filePath)));
    }
  }
  return backupDir;
}

function normalizePlugins(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

function uniq(items) {
  return [...new Set(items)];
}

function readState() {
  const main = readJson(mainConfigPath);
  const secondary = fs.existsSync(secondaryConfigPath) ? readJson(secondaryConfigPath) : null;
  return { main, secondary };
}

function printStatus(state) {
  console.log(JSON.stringify({
    mainConfigPath,
    secondaryConfigPath: fs.existsSync(secondaryConfigPath) ? secondaryConfigPath : null,
    localPluginPath,
    localPluginExists: fs.existsSync(localPluginPath),
    mainPlugins: normalizePlugins(state.main.json.plugin),
    secondaryPlugins: state.secondary ? normalizePlugins(state.secondary.json.plugin) : null,
    stableMode: JSON.stringify(normalizePlugins(state.main.json.plugin)) === JSON.stringify([localPluginPath])
      && (!state.secondary || normalizePlugins(state.secondary.json.plugin).length === 0),
    ohMyEnabled: normalizePlugins(state.main.json.plugin).includes(ohMyPlugin)
      || (state.secondary && normalizePlugins(state.secondary.json.plugin).includes(ohMyPlugin)),
  }, null, 2));
}

function setMode(command) {
  if (!Object.hasOwn(modes, command)) {
    throw new Error(`Command must be one of: status, ${Object.keys(modes).join(", ")}`);
  }
  if ((command === "stable" || command === "local-only" || command === "enable-ohmy") && !fs.existsSync(localPluginPath)) {
    throw new Error(`Local plugin is missing: ${localPluginPath}`);
  }

  const state = readState();
  const files = [mainConfigPath];
  if (state.secondary) files.push(secondaryConfigPath);
  const backupDir = backupFiles(files, `plugin-${command}`);

  state.main.json.plugin = uniq(modes[command]);
  if (state.secondary) state.secondary.json.plugin = [];

  writeJson(mainConfigPath, state.main);
  if (state.secondary) writeJson(secondaryConfigPath, state.secondary);

  console.log(JSON.stringify({
    ok: true,
    command,
    backupDir,
    mainPlugins: state.main.json.plugin,
    secondaryPlugins: state.secondary ? state.secondary.json.plugin : null,
    restartOpenCode: true,
  }, null, 2));
}

function main() {
  const args = parseArgs(process.argv);
  if (args.command === "status") {
    printStatus(readState());
    return;
  }
  setMode(args.command);
  if (args.restartHint) {
    console.log("Restart OpenCode Desktop after changing plugin mode.");
  }
}

main();
