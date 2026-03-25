import {
  DEFAULT_PLATFORM_API_URL,
  DEFAULT_PLATFORM_APP_URL,
  resolvedPlatformApiUrl,
  resolvedPlatformAppUrl,
} from "../src/lib/platform-defaults.js";

describe("platform-defaults", () => {
  const savedApi = process.env.PLATFORM_API_URL;
  const savedApp = process.env.PLATFORM_APP_URL;

  afterEach(() => {
    if (savedApi === undefined) delete process.env.PLATFORM_API_URL;
    else process.env.PLATFORM_API_URL = savedApi;
    if (savedApp === undefined) delete process.env.PLATFORM_APP_URL;
    else process.env.PLATFORM_APP_URL = savedApp;
  });

  it("exposes local dev defaults (app and API are independent)", () => {
    expect(DEFAULT_PLATFORM_APP_URL).toBe("http://localhost:3000");
    expect(DEFAULT_PLATFORM_API_URL).toBe("http://localhost:8080/api-management");
  });

  it("resolvedPlatformApiUrl uses default when env unset", () => {
    delete process.env.PLATFORM_API_URL;
    expect(resolvedPlatformApiUrl()).toBe(DEFAULT_PLATFORM_API_URL);
  });

  it("resolvedPlatformApiUrl normalizes PLATFORM_API_URL", () => {
    process.env.PLATFORM_API_URL = "https://api.example.com/";
    expect(resolvedPlatformApiUrl()).toBe("https://api.example.com");
  });

  it("resolvedPlatformAppUrl uses default when env unset (does not use API url)", () => {
    delete process.env.PLATFORM_APP_URL;
    process.env.PLATFORM_API_URL = "https://api.example.com";
    expect(resolvedPlatformAppUrl()).toBe(DEFAULT_PLATFORM_APP_URL);
  });

  it("resolvedPlatformAppUrl respects PLATFORM_APP_URL", () => {
    process.env.PLATFORM_APP_URL = "https://app.example.com/";
    expect(resolvedPlatformAppUrl()).toBe("https://app.example.com");
  });
});
