// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro's CommonJS configuration entry.
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Expo exposes this configuration helper through CommonJS.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// Native Windows exports can use the app as the Metro server root. Keep shared
// workspace packages visible to Metro when EXPO_NO_METRO_WORKSPACE_ROOT is set.
config.watchFolders = [
  ...new Set([...config.watchFolders, path.resolve(__dirname, "../..")]),
];

module.exports = config;
