import path from "node:path";
import { getDefaultConfig } from "expo/metro-config.js";

const config = getDefaultConfig(import.meta.dirname);

/**
 * The PWA build swaps native-only modules for browser implementations that
 * expose the same API, so screens import them unchanged.
 */
const webAliases = {
  "@maplibre/maplibre-react-native": path.join(import.meta.dirname, "src/web/maplibre/index.tsx"),
};

const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && webAliases[moduleName]) {
    return { type: "sourceFile", filePath: webAliases[moduleName] };
  }
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

export default config;
