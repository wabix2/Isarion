const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

// On EAS build servers the EAS_BUILD env var is always "1".
// In that case, skip monorepo root detection entirely — EAS installs
// dependencies only in the app directory, so the workspace root's
// node_modules won't exist even if pnpm-workspace.yaml is present.
const isEASBuild = process.env.EAS_BUILD === '1';

// Resolve the pnpm monorepo root (3 levels up from the app directory).
const monorepoRoot = path.resolve(__dirname, '../../..');
const monorepoNodeModules = path.resolve(monorepoRoot, 'node_modules');
const useMonorepo =
  !isEASBuild &&
  fs.existsSync(path.join(monorepoRoot, 'pnpm-workspace.yaml')) &&
  fs.existsSync(monorepoNodeModules);

const config = getDefaultConfig(__dirname);

// Expo 52's Metro resolver can miss package-export subpaths from Clerk when
// the app is inside a pnpm workspace. The files are present in Clerk's dist
// directory, so resolve only Clerk React subpaths directly and leave all
// other packages on Metro's normal resolver.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@clerk/react/")) {
    const subpath = moduleName.slice("@clerk/react/".length);
    const clerkPath = path.resolve(
      __dirname,
      "node_modules/@clerk/react/dist",
      `${subpath}.js`,
    );
    if (fs.existsSync(clerkPath)) {
      return { type: "sourceFile", filePath: clerkPath };
    }
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

if (useMonorepo) {
  // Watch the entire monorepo so Metro can resolve packages installed at the
  // workspace root (e.g. @clerk/react, @babel/runtime peer dependencies).
  config.watchFolders = [monorepoRoot];

  // Tell Metro where to look for node_modules when resolving imports.
  // It checks the app-level node_modules first, then falls back to the root.
  config.resolver.nodeModulesPaths = [
    path.resolve(__dirname, 'node_modules'),
    monorepoNodeModules,
  ];
}

module.exports = config;
