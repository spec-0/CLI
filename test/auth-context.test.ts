import { getOrgConfig, setOrgConfig, setDefaultOrg, clearConfig } from "../src/lib/config.js";
import { resolveOrgContext, requireOrgContext } from "../src/lib/auth-context.js";

const ORG_ID = "test-org-authctx";
const BASE_ORG = {
  apiKey: "stored-key",
  name: "Test Org",
  apiUrl: "https://api.spec0.io/api-management",
};

const ENV_VARS = [
  "SPEC0_TOKEN",
  "SPEC0_ORG_ID",
  "SPEC0_API_URL",
  "PLATFORM_API_TOKEN",
  "PLATFORM_ORG_ID",
  "PLATFORM_API_URL",
] as const;
const saved = Object.fromEntries(ENV_VARS.map((k) => [k, process.env[k]]));

function clearEnv() {
  for (const k of ENV_VARS) delete process.env[k];
}

afterEach(() => {
  clearConfig();
  for (const k of ENV_VARS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("resolveOrgContext — stored config", () => {
  beforeEach(() => {
    clearEnv();
    setOrgConfig(ORG_ID, BASE_ORG);
    setDefaultOrg(ORG_ID);
  });

  it("uses stored apiUrl when no env override", () => {
    const ctx = resolveOrgContext();
    expect(ctx?.apiUrl).toBe("https://api.spec0.io/api-management");
    expect(ctx?.apiKey).toBe("stored-key");
  });

  it("SPEC0_API_URL overrides stored apiUrl", () => {
    process.env.SPEC0_API_URL = "https://staging.api.spec0.io/api-management";
    const ctx = resolveOrgContext();
    expect(ctx?.apiUrl).toBe("https://staging.api.spec0.io/api-management");
  });

  it("PLATFORM_API_URL still works as fallback override", () => {
    process.env.PLATFORM_API_URL = "https://legacy.example.com/api-management";
    const ctx = resolveOrgContext();
    expect(ctx?.apiUrl).toBe("https://legacy.example.com/api-management");
  });

  it("returns null when no config and no env", () => {
    clearConfig();
    const ctx = resolveOrgContext();
    expect(ctx).toBeNull();
  });
});

describe("resolveOrgContext — SPEC0_TOKEN env vars (CI mode)", () => {
  beforeEach(clearEnv);

  it("SPEC0_TOKEN + SPEC0_ORG_ID resolves without stored config", () => {
    process.env.SPEC0_TOKEN = "ci-token";
    process.env.SPEC0_ORG_ID = "ci-org-id";
    const ctx = resolveOrgContext();
    expect(ctx).not.toBeNull();
    expect(ctx?.apiKey).toBe("ci-token");
    expect(ctx?.orgId).toBe("ci-org-id");
  });

  it("SPEC0_API_URL sets apiUrl in env mode", () => {
    process.env.SPEC0_TOKEN = "ci-token";
    process.env.SPEC0_ORG_ID = "ci-org-id";
    process.env.SPEC0_API_URL = "https://custom.api.spec0.io/api-management";
    const ctx = resolveOrgContext();
    expect(ctx?.apiUrl).toBe("https://custom.api.spec0.io/api-management");
  });
});

describe("resolveOrgContext — PLATFORM_* legacy fallback (CI mode)", () => {
  beforeEach(clearEnv);

  it("PLATFORM_API_TOKEN + PLATFORM_ORG_ID still work", () => {
    process.env.PLATFORM_API_TOKEN = "legacy-token";
    process.env.PLATFORM_ORG_ID = "legacy-org";
    const ctx = resolveOrgContext();
    expect(ctx).not.toBeNull();
    expect(ctx?.apiKey).toBe("legacy-token");
    expect(ctx?.orgId).toBe("legacy-org");
  });

  it("SPEC0_TOKEN takes priority over PLATFORM_API_TOKEN", () => {
    process.env.SPEC0_TOKEN = "new-token";
    process.env.PLATFORM_API_TOKEN = "old-token";
    process.env.SPEC0_ORG_ID = "org-id";
    const ctx = resolveOrgContext();
    expect(ctx?.apiKey).toBe("new-token");
  });
});

describe("requireOrgContext", () => {
  beforeEach(clearEnv);

  it("throws with SPEC0_TOKEN mentioned when not authenticated", () => {
    clearConfig();
    expect(() => requireOrgContext()).toThrow(/SPEC0_TOKEN/);
    expect(() => requireOrgContext()).toThrow(/SPEC0_ORG_ID/);
  });

  it("does not throw when SPEC0_TOKEN + SPEC0_ORG_ID are set", () => {
    process.env.SPEC0_TOKEN = "t";
    process.env.SPEC0_ORG_ID = "o";
    expect(() => requireOrgContext()).not.toThrow();
  });
});
