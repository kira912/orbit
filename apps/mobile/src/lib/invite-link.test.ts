import { inviteLink, parseInviteCode } from "./invite-link";

describe("parseInviteCode", () => {
  it("reads the code from a web invite link", () => {
    expect(parseInviteCode("https://orbit.example.com/join/WQHSRZTX")).toBe("WQHSRZTX");
    expect(parseInviteCode("https://orbit.example.com/join/wqhsrztx/?utm=qr")).toBe("WQHSRZTX");
  });

  it("reads the code from an app link", () => {
    expect(parseInviteCode("orbit://join/WQHSRZTX")).toBe("WQHSRZTX");
  });

  it("accepts a bare code, whatever its case and surrounding spaces", () => {
    expect(parseInviteCode("  wqhsrztx ")).toBe("WQHSRZTX");
  });

  it("rejects anything else", () => {
    expect(parseInviteCode("https://example.com/menu")).toBeNull();
    expect(parseInviteCode("WIFI:S:home;T:WPA;P:secret;;")).toBeNull();
    expect(parseInviteCode("")).toBeNull();
  });

  it("round-trips the links the app generates", () => {
    expect(parseInviteCode(inviteLink("WQHSRZTX"))).toBe("WQHSRZTX");
  });
});
