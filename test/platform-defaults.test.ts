import {
  DEFAULT_PLATFORM_API_URL,
  DEFAULT_PLATFORM_APP_URL,
  DEFAULT_PLATFORM_MCP_URL,
  resolvedPlatformApiUrl,
  resolvedPlatformAppUrl,
  resolvedPlatformMcpBaseUrl,
  resolvedPlatformMcpUrl,
} from "../src/lib/platform-defaults.js";

describe("platform-defaults", () => {
  const vars = [
    "SPEC0_APP_URL",
    "SPEC0_API_URL",
    "PLATFORM_APP_URL",
    "PLATFORM_API_URL",
    "SPEC0_MCP_URL",
    "PLATFORM_MCP_URL",
  ] as const;
  const saved = Object.fromEntries(vars.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const k of vars) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("production defaults point to spec0.io", () => {
    expect(DEFAULT_PLATFORM_APP_URL).toBe("https://app.spec0.io");
    expect(DEFAULT_PLATFORM_API_URL).toBe("https://api.spec0.io");
    expect(DEFAULT_PLATFORM_MCP_URL).toBe("https://api.spec0.io/mcp");
  });

  describe("resolvedPlatformApiUrl", () => {
    it("returns default when no env set", () => {
      for (const k of vars) delete process.env[k];
      expect(resolvedPlatformApiUrl()).toBe(DEFAULT_PLATFORM_API_URL);
    });

    it("SPEC0_API_URL takes priority", () => {
      process.env.SPEC0_API_URL = "https://api.example.com/";
      process.env.PLATFORM_API_URL = "https://old.example.com";
      expect(resolvedPlatformApiUrl()).toBe("https://api.example.com");
    });

    it("PLATFORM_API_URL works as fallback when SPEC0_API_URL unset", () => {
      delete process.env.SPEC0_API_URL;
      process.env.PLATFORM_API_URL = "https://legacy.example.com/";
      expect(resolvedPlatformApiUrl()).toBe("https://legacy.example.com");
    });

    it("strips trailing slash", () => {
      process.env.SPEC0_API_URL = "https://api.example.com/";
      expect(resolvedPlatformApiUrl()).toBe("https://api.example.com");
    });
  });

  describe("resolvedPlatformAppUrl", () => {
    it("returns default when no env set", () => {
      for (const k of vars) delete process.env[k];
      expect(resolvedPlatformAppUrl()).toBe(DEFAULT_PLATFORM_APP_URL);
    });

    it("SPEC0_APP_URL takes priority", () => {
      process.env.SPEC0_APP_URL = "https://app.example.com/";
      process.env.PLATFORM_APP_URL = "https://old-app.example.com";
      expect(resolvedPlatformAppUrl()).toBe("https://app.example.com");
    });

    it("PLATFORM_APP_URL works as fallback when SPEC0_APP_URL unset", () => {
      delete process.env.SPEC0_APP_URL;
      process.env.PLATFORM_APP_URL = "https://legacy-app.example.com/";
      expect(resolvedPlatformAppUrl()).toBe("https://legacy-app.example.com");
    });

    it("app URL is independent of API URL", () => {
      delete process.env.SPEC0_APP_URL;
      delete process.env.PLATFORM_APP_URL;
      process.env.SPEC0_API_URL = "https://api.example.com";
      expect(resolvedPlatformAppUrl()).toBe(DEFAULT_PLATFORM_APP_URL);
    });
  });

  describe("resolvedPlatformMcpUrl", () => {
    it("returns the single Streamable HTTP endpoint by default", () => {
      for (const k of vars) delete process.env[k];
      expect(resolvedPlatformMcpUrl()).toBe("https://api.spec0.io/mcp");
    });

    it("SPEC0_MCP_URL takes priority and is normalized", () => {
      process.env.SPEC0_MCP_URL = "https://staging.spec0.io/mcp/";
      process.env.PLATFORM_MCP_URL = "https://old.spec0.io/mcp";
      expect(resolvedPlatformMcpUrl()).toBe("https://staging.spec0.io/mcp");
    });

    it("PLATFORM_MCP_URL works as fallback when SPEC0_MCP_URL unset", () => {
      delete process.env.SPEC0_MCP_URL;
      process.env.PLATFORM_MCP_URL = "https://legacy.spec0.io/mcp";
      expect(resolvedPlatformMcpUrl()).toBe("https://legacy.spec0.io/mcp");
    });
  });

  describe("resolvedPlatformMcpBaseUrl", () => {
    it("yields a sane health target from the default endpoint", () => {
      for (const k of vars) delete process.env[k];
      // No trailing /sse to strip: the endpoint is already the base.
      expect(resolvedPlatformMcpBaseUrl()).toBe("https://api.spec0.io/mcp");
      expect(`${resolvedPlatformMcpBaseUrl()}/health`).toBe("https://api.spec0.io/mcp/health");
    });

    it("still trims a legacy trailing /sse from an override for back-compat", () => {
      process.env.SPEC0_MCP_URL = "https://legacy.spec0.io/mcp/sse";
      expect(resolvedPlatformMcpBaseUrl()).toBe("https://legacy.spec0.io/mcp");
    });
  });
});
