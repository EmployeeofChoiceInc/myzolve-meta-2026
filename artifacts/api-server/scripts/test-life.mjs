import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const temporaryDirectory = await mkdtemp(join(process.cwd(), ".life-tests-"));
const testBundle = join(temporaryDirectory, "life.test.mjs");

try {
  await build({
    entryPoints: [
      fileURLToPath(new URL("../src/lib/metaLifePlanner.test.ts", import.meta.url)),
    ],
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["express"],
    outfile: testBundle,
    logLevel: "warning",
  });

  const result = spawnSync(process.execPath, ["--test", testBundle], {
    stdio: "inherit",
    env: { ...process.env, MODEL_API_KEY: "life-test-key" },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
