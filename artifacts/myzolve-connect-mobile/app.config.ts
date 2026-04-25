import type { ExpoConfig } from "expo/config";

import appJson from "./app.json";

const isEasContext =
  process.env.EAS_BUILD === "true" ||
  process.env.EAS_BUILD === "1" ||
  process.env.EAS_UPDATE === "true" ||
  process.env.EAS_UPDATE === "1" ||
  !!process.env.EAS_BUILD_PROFILE ||
  !!process.env.EAS_UPDATE_BRANCH;

const base = appJson.expo as ExpoConfig;

const config: ExpoConfig = { ...base };

if (!isEasContext) {
  delete (config as { runtimeVersion?: unknown }).runtimeVersion;
}

export default (): ExpoConfig => config;
