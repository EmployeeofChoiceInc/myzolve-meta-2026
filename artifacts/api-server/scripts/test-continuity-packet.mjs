import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "continuity-packet-tests-"));
const entries = [
  fileURLToPath(
    new URL("../src/lib/continuityPacketRules.test.ts", import.meta.url),
  ),
  fileURLToPath(
    new URL(
      "../../myzolve-connect/src/lib/continuity-packet-pdf.test.ts",
      import.meta.url,
    ),
  ),
];

try {
  await build({
    entryPoints: entries,
    bundle: true,
    platform: "node",
    format: "esm",
    outdir: temporaryDirectory,
    entryNames: "[name]",
    outExtension: { ".js": ".mjs" },
    logLevel: "warning",
  });

  let exitCode = 0;
  for (const entry of entries) {
    const bundle = join(
      temporaryDirectory,
      `${entry.split("/").at(-1).replace(/\.ts$/, ".mjs")}`,
    );
    const result = spawnSync(process.execPath, ["--test", bundle], {
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) exitCode = result.status ?? 1;
  }
  process.exitCode = exitCode;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
