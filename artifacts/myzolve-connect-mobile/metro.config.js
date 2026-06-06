const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;

// The mobile directory has its own pnpm-workspace.yaml for EAS builds.
// Expo's getDefaultConfig detects workspace root by searching upward for
// pnpm-workspace.yaml, which now finds this directory instead of the repo
// root. That shrinks watchFolders to just the mobile dir, breaking bundle
// URL resolution (paths are relative to the outermost watched folder).
// Force the real workspace root so Metro watches the full repo tree.
const workspaceRoot = path.resolve(projectRoot, "..", "..");

const config = getDefaultConfig(projectRoot);

const existingFolders = new Set(config.watchFolders || []);
if (!existingFolders.has(workspaceRoot)) {
  config.watchFolders = [workspaceRoot, ...existingFolders];
}

module.exports = config;
