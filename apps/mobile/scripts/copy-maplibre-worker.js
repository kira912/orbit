#!/usr/bin/env node
/**
 * maplibre-gl locates its web worker through import.meta.url, which Metro
 * doesn't provide: ship the (self-contained) worker as a static file in
 * public/ instead, where src/web/maplibre points maplibre-gl at it.
 */
const fs = require("node:fs");
const path = require("node:path");

const source = require.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs", { paths: [__dirname] });
const target = path.join(__dirname, "..", "public", "maplibre-gl-worker.mjs");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
