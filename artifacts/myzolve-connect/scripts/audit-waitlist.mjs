#!/usr/bin/env node
// Bundle audit: confirm no project-owned "/waitlist" route shipped to production.
//
// Connect intentionally does NOT mount Clerk's waitlist UI. Clerk's SDK still
// ships internal references to its own waitlist feature (mountWaitlist,
// redirectToWaitlist, waitlist.pathRoot:"/waitlist", etc.) — those literals
// are inert and explicitly allowlisted below.
//
// Fail the audit if any "/waitlist" string appears in a context that is NOT
// a known Clerk-internal one. That guarantees no app-owned waitlist route or
// link can ever sneak into the bundle without us noticing.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(here, "..", "dist", "public", "assets");

const ALLOWED_CONTEXT = /(?:mount|unmount|preopen|preopenWaitlist|premount|premountWaitlist|premountWaitlistNodes|openWaitlist|closeWaitlist|redirectToWaitlist|joinWaitlist|buildWaitlistUrl|buildWaitlistProxy|waitlistSignal|waitlistSignalProxy|__internal_waitlist|waitlist:\{pathRoot|component:"Waitlist"|"Waitlist")/;

let files;
try {
  files = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
} catch (err) {
  console.error(`Build output missing at ${assetsDir}. Run 'pnpm build' first.`);
  process.exit(1);
}

let failures = 0;
for (const name of files) {
  const code = readFileSync(join(assetsDir, name), "utf8");
  let idx = 0;
  while ((idx = code.indexOf("/waitlist", idx)) !== -1) {
    const window = code.slice(Math.max(0, idx - 80), idx + 80);
    if (!ALLOWED_CONTEXT.test(window)) {
      failures += 1;
      console.error(`Unexpected /waitlist in ${name}: ...${window}...`);
    }
    idx += 1;
  }
}

if (failures > 0) {
  console.error(`\nFAIL: ${failures} unexpected /waitlist occurrence(s).`);
  process.exit(1);
}
console.log("OK: no app-owned /waitlist references in production bundle.");
