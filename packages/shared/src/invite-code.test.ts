import { describe, expect, it } from "vitest";
import { generateInviteCode } from "./invite-code";

describe("generateInviteCode", () => {
  it("defaults to an 8-character code", () => {
    expect(generateInviteCode()).toHaveLength(8);
  });

  it("respects a custom length", () => {
    expect(generateInviteCode(5)).toHaveLength(5);
  });

  it("never contains visually ambiguous characters (0, O, 1, I, L)", () => {
    // Deterministic RNG walking through the full [0,1) range.
    const steps = 200;
    for (let i = 0; i < steps; i++) {
      const code = generateInviteCode(20, () => i / steps);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it("is deterministic given a deterministic RNG", () => {
    const rng = () => 0;
    expect(generateInviteCode(4, rng)).toBe(generateInviteCode(4, rng));
  });
});
