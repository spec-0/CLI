import { getConfig, setOrgConfig, setDefaultOrg, clearConfig, getOrgConfig } from "../src/lib/config.js";

describe("config", () => {
  const testOrgId = "test-org-" + Date.now();

  afterEach(() => {
    clearConfig();
  });

  it("returns default config", () => {
    const config = getConfig();
    expect(config.version).toBe(1);
    expect(config.telemetry).toBe(true);
    expect(Object.keys(config.orgs).length).toBeGreaterThanOrEqual(0);
  });

  it("stores and retrieves org config", () => {
    setOrgConfig(testOrgId, {
      apiKey: "key",
      name: "acme",
      apiUrl: "https://api.winspect.io",
    });
    const org = getOrgConfig(testOrgId);
    expect(org?.name).toBe("acme");
  });

  it("stores default org", () => {
    setOrgConfig(testOrgId, { apiKey: "k", name: "a", apiUrl: "https://x.io" });
    setDefaultOrg(testOrgId);
    expect(getConfig().defaultOrg).toBe(testOrgId);
  });
});
