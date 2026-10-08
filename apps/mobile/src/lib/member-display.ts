/**
 * Presentation helpers shared by the map markers and the member sheet, so a
 * member keeps the same color and initials everywhere.
 */

// Distinct, saturated hues that stay readable with white text and on the map's light basemap.
const MEMBER_COLORS = [
  "#2563eb", // blue
  "#db2777", // pink
  "#16a34a", // green
  "#ea580c", // orange
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#ca8a04", // amber
  "#dc2626", // red
  "#4f46e5", // indigo
  "#0d9488", // teal
];

/** Stable color for a user: hashing the id keeps it identical across sessions and devices. */
export function memberColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length];
}

/** "Ada Lovelace" -> "AL", "bob" -> "BO". */
export function memberInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** A position older than this is shown as stale (faded marker, warning in the sheet). */
export const STALE_AFTER_MS = 15 * 60 * 1000;

export function isStale(recordedAt: Date | string, now: number): boolean {
  return now - new Date(recordedAt).getTime() > STALE_AFTER_MS;
}

export function formatRelativeTime(date: Date | string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(date).getTime()) / 1000));
  if (seconds < 60) return "à l'instant";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0).replace(".", ",")} km`;
}
