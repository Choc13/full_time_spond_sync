import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const NAME = "FA Spond Sync";
const FILE = "FA-Spond-Sync";
const ICON = { color: "green", glyph: "futbol" };

const gitSha = () => {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
};
const version = (process.env.GITHUB_SHA ?? gitSha()).slice(0, 7);

mkdirSync("dist", { recursive: true });

// Don't enable minify or keepNames: extractFixturesPage is sent to the WebView as source
// text, and keepNames would add a helper call that doesn't exist there.
await build({
  entryPoints: ["src/main.ts"],
  outfile: `dist/${FILE}.js`,
  bundle: true,
  format: "iife",
  globalName: "FASpondSync",
  target: "es2020",
  charset: "utf8",
  define: { __VERSION__: JSON.stringify(version) },
  banner: { js: `// Variables used by Scriptable.\n// These must be at the very top of the file. Do not edit.\n// icon-color: ${ICON.color}; icon-glyph: ${ICON.glyph};\n` },
  footer: { js: "await FASpondSync.run();" },
});

writeFileSync(
  `dist/${FILE}.scriptable`,
  JSON.stringify({ always_run_in_app: true, icon: ICON, name: NAME, script: readFileSync(`dist/${FILE}.js`, "utf8"), share_sheet_inputs: [] }, null, 2),
);
console.log(`Built ${FILE} ${version}`);
