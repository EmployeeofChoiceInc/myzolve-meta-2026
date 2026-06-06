const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;

// The mobile directory has its own pnpm-workspace.yaml for EAS builds.
// Expo's getDefaultConfig detects workspace root by searching upward for
// pnpm-workspace.yaml, which now finds this directory instead of the repo
// root. That breaks several Metro settings that assume the real workspace root.
const workspaceRoot = path.resolve(projectRoot, "..", "..");

const config = getDefaultConfig(projectRoot);

// Fix 1: Ensure workspace root is in watchFolders so Metro can follow
// symlinks from mobile/node_modules/* into workspace_root/node_modules/.pnpm/*
const existingFolders = new Set(config.watchFolders || []);
if (!existingFolders.has(workspaceRoot)) {
  config.watchFolders = [workspaceRoot, ...existingFolders];
}

// Fix 2: Ensure workspace root's node_modules is in nodeModulesPaths so
// Metro resolves packages from the correct location.
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.join(workspaceRoot, "node_modules"),
    ...(config.resolver?.nodeModulesPaths || []),
  ].filter((v, i, a) => a.indexOf(v) === i),
};

// Fix 3: Rewrite incoming bundle URLs that use .pnpm real paths back to
// their symlink-relative equivalents.
//
// When getDefaultConfig incorrectly uses the mobile dir as workspace root,
// Metro follows symlinks for module resolution and generates manifest URLs
// using real paths: /node_modules/.pnpm/<pkg>/node_modules/<name>/entry.bundle
// But when serving, Metro resolves the path relative to projectRoot (mobile
// dir), where .pnpm doesn't exist → 404.
//
// Rewriting /node_modules/.pnpm/X/node_modules/Y → /node_modules/Y restores
// the symlink path that projectRoot CAN resolve, and watchFolders (fix 1)
// ensures the resolved symlink target is within Metro's allowed paths.
const originalRewrite = config.server?.rewriteRequestUrl;
config.server = {
  ...config.server,
  rewriteRequestUrl: (url) => {
    const rewritten = url.replace(
      /\/node_modules\/\.pnpm\/[^/]+\/node_modules\//g,
      "/node_modules/"
    );
    return originalRewrite ? originalRewrite(rewritten) : rewritten;
  },
};

module.exports = config;
