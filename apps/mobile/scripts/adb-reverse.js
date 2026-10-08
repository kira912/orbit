#!/usr/bin/env node
/**
 * Forwards the API port from every connected Android device to this machine,
 * so the app's "localhost:3333" (see src/constants/config.ts) reaches the dev API
 * over USB or wireless adb. Never fails the calling script.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PORT = process.env.API_PORT ?? "3333";

function resolveAdb() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), "Android", "Sdk"), // Linux default
    path.join(os.homedir(), "Library", "Android", "sdk"), // macOS default
  ]
    .filter(Boolean)
    .map((sdk) => path.join(sdk, "platform-tools", "adb"));
  return candidates.find((bin) => fs.existsSync(bin)) ?? "adb";
}

const adb = resolveAdb();

function run(args) {
  return execFileSync(adb, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

try {
  const devices = run(["devices"])
    .split("\n")
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === "device")
    .map(([serial]) => serial);

  if (devices.length === 0) {
    console.log("[adb-reverse] no Android device connected, skipping");
  }
  for (const serial of devices) {
    try {
      run(["-s", serial, "reverse", `tcp:${PORT}`, `tcp:${PORT}`]);
      console.log(`[adb-reverse] ${serial}: tcp:${PORT} -> localhost:${PORT}`);
    } catch (err) {
      console.warn(`[adb-reverse] ${serial}: failed (${err.stderr?.trim() || err.message})`);
    }
  }
} catch (err) {
  console.warn(`[adb-reverse] adb unavailable (${err.message}), skipping`);
}
