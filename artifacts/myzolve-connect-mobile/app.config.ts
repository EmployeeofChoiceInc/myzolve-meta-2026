import type { ExpoConfig } from "expo/config";

import appJson from "./app.json";

// Detect when the config is being read inside an EAS context (build, update,
// or submit). The EAS CLI itself doesn't set a single canonical env var across
// every subcommand — `eas build` sets EAS_BUILD/EAS_BUILD_PROFILE, but `eas
// update` does NOT set EAS_UPDATE consistently across CLI versions. Without
// argv-level detection, `eas update` strips runtimeVersion and then fails
// with "Cannot read properties of undefined (reading 'policy')". So we ALSO
// look at the EAS CLI's own argv for the "update", "build", or "submit"
// subcommand. Local `expo start` / Expo Go runs neither of these.
const easSubcommand = process.argv.find(
  (a) => a === "update" || a === "build" || a === "submit",
);
const isEasContext =
  process.env.EAS_BUILD === "true" ||
  process.env.EAS_BUILD === "1" ||
  process.env.EAS_UPDATE === "true" ||
  process.env.EAS_UPDATE === "1" ||
  !!process.env.EAS_BUILD_PROFILE ||
  !!process.env.EAS_UPDATE_BRANCH ||
  !!process.env.EAS_UPDATE_CHANNEL ||
  !!process.env.EAS_PROJECT_ID ||
  !!easSubcommand;

const base = appJson.expo as ExpoConfig;

const config: ExpoConfig = { ...base };

if (!isEasContext) {
  delete (config as { runtimeVersion?: unknown }).runtimeVersion;
}

export default (): ExpoConfig => config;
