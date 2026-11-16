// Syncs the appended Dominion League avatar WebPs into the external Avatar Lab page.
// Usage: node scripts/sync-avatar-lab.mjs /path/to/dominion-player-avatars.html
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/sync-avatar-lab.mjs <dominion-player-avatars.html>");
  process.exit(1);
}

const assetRoot = new URL("../src/assets/avatars/", import.meta.url);
const uri = (name) => `data:image/webp;base64,${readFileSync(new URL(name, assetRoot)).toString("base64")}`;
const sync = (source, constant, prefix) => {
  const pattern = new RegExp(`^const ${constant}=(\\[.*\\]);$`, "m");
  const match = source.match(pattern);
  if (!match) throw new Error(`${constant} array not found in ${target}`);
  const values = JSON.parse(match[1]);
  for (let index = 6; index <= 10; index++) values[index] = uri(`${prefix}${index}.webp`);
  return source.replace(pattern, `const ${constant}=${JSON.stringify(values)};`);
};

const file = resolve(target);
let source = readFileSync(file, "utf8");
source = sync(source, "artwork", "a");
source = sync(source, "alternateFaces", "b");
writeFileSync(file, source);
