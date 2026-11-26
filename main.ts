// Ringrunner hand-in program: copies the playable game and its screenshots
// into the output directory, then writes the dossier the judge reads.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDossier } from "./vendor/makefun-game.ts";

const repoRoot = import.meta.dirname;
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

function copyTree(name: string): void {
  const from = join(repoRoot, name);
  const to = join(outputDir, name);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
if (!existsSync(join(repoRoot, "game", "index.html"))) {
  throw new Error("Ringrunner: game/index.html is missing from the repository");
}
copyTree("game");
copyTree("screenshots");

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, "dossier.json"), dossier);
console.log("Ringrunner: game, screenshots and dossier.json written to " + outputDir);
