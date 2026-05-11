import {
  DEFAULT_PLATFORM_API_URL,
  DEFAULT_PLATFORM_APP_URL,
  resolvedPlatformApiUrl,
  resolvedPlatformAppUrl,
} from "../src/lib/platform-defaults.js";

describe("platform-defaults", () => {
  const vars = ["SPEC0_APP_URL", "SPEC0_API_URL", "PLATFORM_APP_URL", "PLATFORM_API_URL"] as const;
  const saved = Object.fromEntries(vars.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const k of vars) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("production defaults point to spec0.io", () => {
    expect(DEFAULT_PLATFORM_APP_URL).toBe("https://app.spec0.io");
    expect(DEFAULT_PLATFORM_API_URL).toBe("https://api.spec0.io/api-management");
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
      process.env.SPEC0_API_URL = "https://api.example.com/api-management/";
      expect(resolvedPlatformApiUrl()).toBe("https://api.example.com/api-management");
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
});
