import { getOrgConfig, setOrgConfig, setDefaultOrg, clearConfig } from "../src/lib/config.js";
import { resolveOrgContext } from "../src/lib/auth-context.js";

describe("resolveOrgContext", () => {
  const orgId = "test-org-authctx";
  const savedApi = process.env.PLATFORM_API_URL;
  const savedToken = process.env.PLATFORM_API_TOKEN;
  const savedOrgEnv = process.env.PLATFORM_ORG_ID;

  afterEach(() => {
    clearConfig();
    if (savedApi === undefined) delete process.env.PLATFORM_API_URL;
    else process.env.PLATFORM_API_URL = savedApi;
    if (savedToken === undefined) delete process.env.PLATFORM_API_TOKEN;
    else process.env.PLATFORM_API_TOKEN = savedToken;
    if (savedOrgEnv === undefined) delete process.env.PLATFORM_ORG_ID;
    else process.env.PLATFORM_ORG_ID = savedOrgEnv;
  });

  it("uses stored apiUrl when PLATFORM_API_URL is unset", () => {
    delete process.env.PLATFORM_API_TOKEN;
    delete process.env.PLATFORM_ORG_ID;
    delete process.env.PLATFORM_API_URL;

    setOrgConfig(orgId, {
      apiKey: "k",
      name: "n",
      apiUrl: "http://localhost:8080/api-management",
    });
    setDefaultOrg(orgId);

    const ctx = resolveOrgContext();
    expect(ctx?.apiUrl).toBe("http://localhost:8080/api-management");
  });

  it("PLATFORM_API_URL overrides stale stored apiUrl (interactive login)", () => {
    delete process.env.PLATFORM_API_TOKEN;
    delete process.env.PLATFORM_ORG_ID;
    process.env.PLATFORM_API_URL = "http://localhost:8080/api-management";

    setOrgConfig(orgId, {
      apiKey: "k",
      name: "n",
      apiUrl: "http://localhost:3000",
    });
    setDefaultOrg(orgId);

    const ctx = resolveOrgContext();
    expect(ctx?.apiUrl).toBe("http://localhost:8080/api-management");
  });
});
