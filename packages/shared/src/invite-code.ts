// Crockford-ish alphabet: no 0/O, 1/I/L, to avoid ambiguous invite codes read aloud or typed.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const DEFAULT_LENGTH = 8;

export function generateInviteCode(
  length = DEFAULT_LENGTH,
  randomFn: () => number = Math.random,
): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    const index = Math.floor(randomFn() * ALPHABET.length);
    code += ALPHABET[index];
  }
  return code;
}
