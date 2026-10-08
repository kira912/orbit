#!/usr/bin/env node
/**
 * Guards production web builds (Vercel): EXPO_PUBLIC_* values are inlined at
 * bundling time, so a missing API URL would ship a PWA pointing at nowhere.
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  console.error("EXPO_PUBLIC_API_URL is not set: point it at the production API (https://…).");
  process.exit(1);
}
if (!apiUrl.startsWith("https://")) {
  // An https page can't call an http API (mixed content), nor open ws:// sockets.
  console.error(`EXPO_PUBLIC_API_URL must be an https:// URL (got ${apiUrl}).`);
  process.exit(1);
}
if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
  console.warn("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set: the Google button will be hidden.");
}
