import { WEB_URL } from "../constants/config";

/** Invite codes are generated uppercase alphanumeric (see @orbit/shared invite-code). */
const CODE_PATTERN = /^[A-Z0-9]{4,16}$/;

/** The link a QR code or a shared invite points to: opens /join/<code>. */
export function inviteLink(code: string): string {
  return WEB_URL ? `${WEB_URL}/join/${code}` : `orbit://join/${code}`;
}

/**
 * The invite code in whatever was scanned or typed: an invite link (web or
 * orbit://) or the bare code. Null when it's anything else (another QR code).
 */
export function parseInviteCode(text: string): string | null {
  const trimmed = text.trim();
  const fromLink = trimmed.match(/\/join\/([A-Za-z0-9]+)\/?(?:[?#].*)?$/)?.[1];
  const code = (fromLink ?? trimmed).toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}
