const fs = require("node:fs");
const path = require("node:path");

const archivePath = process.argv[2] || "D:/Program Files/opencode/resources/app.asar";
const command = process.argv[3] || "list";
const pattern = process.argv[4] || "";

function readUInt32(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function readHeader(buffer) {
  const headerSize = readUInt32(buffer, 4);
  const headerStringSize = readUInt32(buffer, 12);
  const headerJson = buffer
    .subarray(16, 16 + headerStringSize)
    .toString("utf8")
    .replace(/\0+$/, "");
  return {
    header: JSON.parse(headerJson),
    dataOffset: 8 + headerSize,
  };
}

function walkFiles(node, prefix = "") {
  const files = [];
  for (const [name, child] of Object.entries(node.files || {})) {
    const full = prefix ? `${prefix}/${name}` : name;
    if (child.files) files.push(...walkFiles(child, full));
    else files.push({ path: full, ...child });
  }
  return files;
}

const archive = fs.readFileSync(archivePath);
const { header, dataOffset } = readHeader(archive);
const files = walkFiles(header);

if (command === "list") {
  const match = pattern ? files.filter((file) => file.path.includes(pattern)) : files;
  console.log(match.map((file) => `${file.path}\t${file.size || 0}`).join("\n"));
} else if (command === "grep") {
  const re = new RegExp(pattern, "i");
  for (const file of files) {
    if (!/\.(js|json|html|css|mjs|cjs|ts|tsx|jsx)$/i.test(file.path)) continue;
    const start = dataOffset + Number(file.offset || 0);
    const end = start + Number(file.size || 0);
    const text = archive.subarray(start, end).toString("utf8");
    if (re.test(text)) console.log(file.path);
  }
} else if (command === "cat") {
  const file = files.find((item) => item.path === pattern);
  if (!file) throw new Error(`Not found: ${pattern}`);
  const start = dataOffset + Number(file.offset || 0);
  const end = start + Number(file.size || 0);
  process.stdout.write(archive.subarray(start, end));
} else if (command === "snip") {
  const [filePath, regexText, beforeText = "500", afterText = "1200"] = process.argv.slice(4);
  const file = files.find((item) => item.path === filePath);
  if (!file) throw new Error(`Not found: ${filePath}`);
  const start = dataOffset + Number(file.offset || 0);
  const end = start + Number(file.size || 0);
  const text = archive.subarray(start, end).toString("utf8");
  const regex = new RegExp(regexText, "g");
  const before = Number(beforeText);
  const after = Number(afterText);
  let match;
  let count = 0;
  while ((match = regex.exec(text))) {
    count++;
    const from = Math.max(0, match.index - before);
    const to = Math.min(text.length, match.index + match[0].length + after);
    console.log(`\n--- match ${count} at ${match.index} ---\n`);
    console.log(text.slice(from, to));
    if (match[0].length === 0) regex.lastIndex++;
    if (count >= 20) break;
  }
  if (count === 0) process.exitCode = 1;
} else {
  throw new Error(`Unknown command: ${command}`);
}
