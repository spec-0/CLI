import { isNewer } from "../src/lib/update-check.js";

describe("isNewer", () => {
  it("returns true when major is higher", () => {
    expect(isNewer("2.0.0", "1.9.9")).toBe(true);
  });

  it("returns true when minor is higher", () => {
    expect(isNewer("1.3.0", "1.2.9")).toBe(true);
  });

  it("returns true when patch is higher", () => {
    expect(isNewer("1.2.4", "1.2.3")).toBe(true);
  });

  it("returns false for equal versions", () => {
    expect(isNewer("1.2.3", "1.2.3")).toBe(false);
  });

  it("returns false when candidate is older — major", () => {
    expect(isNewer("0.9.9", "1.0.0")).toBe(false);
  });

  it("returns false when candidate is older — minor", () => {
    expect(isNewer("1.1.9", "1.2.0")).toBe(false);
  });

  it("returns false when candidate is older — patch", () => {
    expect(isNewer("1.2.2", "1.2.3")).toBe(false);
  });

  it("handles missing patch segment gracefully — treats as 1.3.0 > 1.2.3", () => {
    expect(isNewer("1.3", "1.2.3")).toBe(true); // "1.3" → minor=3 > 2
    expect(isNewer("1.2", "1.2.3")).toBe(false); // "1.2" → 1.2.0 < 1.2.3
  });
});
