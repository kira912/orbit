#!/usr/bin/env node
/**
 * Dev tool: logs in as a test account and sends a fake position every few
 * seconds (walking in a loop around a center point, battery slowly draining),
 * so another device can check how circle members show up on the map.
 *
 *   pnpm --filter @orbit/api simulate:member                       # Bob around Versailles
 *   pnpm --filter @orbit/api simulate:member -- --email ada@test.dev --lat 48.80 --lng 2.13
 *
 * Options: --email, --password, --lat, --lng, --radius (m), --speed (km/h), --interval (s), --api (URL)
 */
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    email: { type: "string", default: "bob@test.dev" },
    password: { type: "string", default: "password123" },
    lat: { type: "string", default: "48.8049" }, // Versailles
    lng: { type: "string", default: "2.1204" },
    radius: { type: "string", default: "300" },
    speed: { type: "string", default: "5" }, // walking pace
    interval: { type: "string", default: "5" },
    api: { type: "string", default: `http://localhost:${process.env.PORT ?? 3333}` },
  },
});

const center = { latitude: Number(values.lat), longitude: Number(values.lng) };
const radiusMeters = Number(values.radius);
const intervalMs = Number(values.interval) * 1000;
const speedMps = Number(values.speed) / 3.6;
// Angle covered per ping so the member moves at the requested speed along the loop.
const anglePerStep = (speedMps * (intervalMs / 1000)) / radiusMeters;

async function post(path, body, token) {
  const res = await fetch(`${values.api}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function login() {
  const { user, tokens } = await post("/auth/login", { email: values.email, password: values.password });
  return { user, token: tokens.accessToken };
}

/** Point on a circle around the center; ~111 km per degree of latitude. */
function positionAt(angle) {
  const dLat = (radiusMeters * Math.cos(angle)) / 111_320;
  const dLng = (radiusMeters * Math.sin(angle)) / (111_320 * Math.cos((center.latitude * Math.PI) / 180));
  return { latitude: center.latitude + dLat, longitude: center.longitude + dLng };
}

let { user, token } = await login();
console.log(`Connecté en tant que ${user.displayName} (${user.email}). Ctrl+C pour arrêter.`);

let angle = 0;
let battery = 0.85;

for (;;) {
  const ping = {
    ...positionAt(angle),
    accuracy: 8 + Math.random() * 12,
    speed: speedMps,
    heading: ((angle * 180) / Math.PI + 90) % 360,
    batteryLevel: Math.round(battery * 100) / 100,
    batteryCharging: false,
    recordedAt: new Date().toISOString(),
  };

  try {
    await post("/locations/ping", ping, token);
  } catch (err) {
    if (String(err.message).includes("HTTP 401")) {
      ({ token } = await login()); // access token expired (15 min): log in again
      continue;
    }
    console.error(err.message);
  }

  console.log(
    `${new Date().toLocaleTimeString("fr-FR")}  ${ping.latitude.toFixed(5)}, ${ping.longitude.toFixed(5)}  batterie ${Math.round(ping.batteryLevel * 100)} %`,
  );

  angle = (angle + anglePerStep) % (2 * Math.PI);
  battery = battery <= 0.05 ? 0.85 : battery - 0.01; // drains to show the low-battery badge, then resets
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
