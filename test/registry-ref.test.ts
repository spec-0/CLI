import { parseRegistryRef } from "../src/lib/registry-ref.js";

describe("registry-ref", () => {
  it("parses org/api", () => {
    expect(parseRegistryRef("acme/order-api")).toEqual({
      org: "acme",
      api: "order-api",
      tag: undefined,
    });
  });

  it("parses org/api@tag", () => {
    expect(parseRegistryRef("acme/order-api@1.2.0")).toEqual({
      org: "acme",
      api: "order-api",
      tag: "1.2.0",
    });
  });

  it("rejects missing slash", () => {
    expect(() => parseRegistryRef("order-api")).toThrow(/org-slug/);
  });
});
