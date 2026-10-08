const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const roots = ["js", "scripts", "tests", "server.cjs"];
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(?:c?js)$/.test(entry.name)) files.push(file);
  }
}

for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  if (fs.statSync(root).isFile()) files.push(root);
  else walk(root);
}

const failures = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failures.push(`${file}\n${result.stderr || result.stdout}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`check-syntax: PASS (${files.length} JavaScript files)`);
