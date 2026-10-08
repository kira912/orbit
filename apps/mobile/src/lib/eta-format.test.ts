import { formatDistance, formatEta } from "./eta-format";

describe("formatEta", () => {
  it("shows '< 1 min' under a minute", () => {
    expect(formatEta(30)).toBe("< 1 min");
  });

  it("rounds to the nearest minute under an hour", () => {
    expect(formatEta(150)).toBe("3 min"); // 2.5 min rounds to 3
  });

  it("switches to hours and minutes past an hour", () => {
    expect(formatEta(3600 + 15 * 60)).toBe("1 h 15 min");
  });

  it("omits minutes on an exact number of hours", () => {
    expect(formatEta(2 * 3600)).toBe("2 h");
  });
});

describe("formatDistance", () => {
  it("shows meters under a kilometer", () => {
    expect(formatDistance(850)).toBe("850 m");
  });

  it("switches to kilometers with one decimal past 1000m", () => {
    expect(formatDistance(1500)).toBe("1.5 km");
  });
});
