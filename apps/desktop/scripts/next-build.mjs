import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildFile = resolve(__dirname, "build.json");

const defaultBuild = { number: 1 };

function readBuild() {
  if (!existsSync(buildFile)) return defaultBuild;
  try {
    return JSON.parse(readFileSync(buildFile, "utf-8"));
  } catch {
    return defaultBuild;
  }
}

function writeBuild(build) {
  writeFileSync(buildFile, JSON.stringify(build, null, 2) + "\n");
}

const build = readBuild();
const buildNumber = build.number;

// Increment for next time
build.number += 1;
writeBuild(build);
console.log(`Build #${buildNumber} → saved in scripts/build.json`);
// Print for vite to consume
process.stdout.write(String(buildNumber));
