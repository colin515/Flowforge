import { readFileSync } from "node:fs";
const config = JSON.parse(readFileSync("config.json"));
if (
  !/^[\w.-]+\/[\w.-]+$/.test(config.repository) ||
  config.repository.startsWith("YOUR_")
)
  throw new Error("Set config.json repository to owner/repo.");
const root = JSON.parse(readFileSync("package.json")),
  desktop = JSON.parse(readFileSync("apps/desktop/package.json")),
  tauri = JSON.parse(readFileSync("apps/desktop/src-tauri/tauri.conf.json"));
const cargo = readFileSync("apps/desktop/src-tauri/Cargo.toml", "utf8").match(
  /^version = "([^"]+)"/m,
)?.[1];
for (const v of [root.version, desktop.version, tauri.version, cargo])
  if (v !== config.version)
    throw new Error("Keep config, package, Cargo and Tauri versions aligned.");
console.log(
  `Release configuration ready: ${config.repository} v${config.version}`,
);
