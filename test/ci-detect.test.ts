import { detectCI, hasPlatformEnv } from "../src/lib/ci-detect.js";

const ENV_VARS = [
  "SPEC0_TOKEN",
  "SPEC0_ORG_ID",
  "PLATFORM_API_TOKEN",
  "PLATFORM_ORG_ID",
  "GITHUB_ACTIONS",
  "GITHUB_SHA",
  "GITHUB_REF_NAME",
  "GITHUB_REPOSITORY",
  "GITHUB_REPOSITORY_OWNER",
  "GITLAB_CI",
  "CI_COMMIT_SHA",
  "CI_COMMIT_REF_NAME",
  "CI_PROJECT_PATH",
  "CI_PROJECT_NAMESPACE",
  "BITBUCKET_BUILD_NUMBER",
  "BITBUCKET_COMMIT",
  "BITBUCKET_BRANCH",
  "BITBUCKET_WORKSPACE",
  "BITBUCKET_REPO_SLUG",
] as const;

const saved = Object.fromEntries(ENV_VARS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of ENV_VARS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function clearCiEnv() {
  for (const k of ENV_VARS) delete process.env[k];
}

describe("hasPlatformEnv", () => {
  it("returns true with SPEC0_TOKEN + SPEC0_ORG_ID", () => {
    clearCiEnv();
    process.env.SPEC0_TOKEN = "tok";
    process.env.SPEC0_ORG_ID = "org";
    expect(hasPlatformEnv()).toBe(true);
  });

  it("returns true with legacy PLATFORM_API_TOKEN + PLATFORM_ORG_ID", () => {
    clearCiEnv();
    process.env.PLATFORM_API_TOKEN = "tok";
    process.env.PLATFORM_ORG_ID = "org";
    expect(hasPlatformEnv()).toBe(true);
  });

  it("returns false when only token is set", () => {
    clearCiEnv();
    process.env.SPEC0_TOKEN = "tok";
    expect(hasPlatformEnv()).toBe(false);
  });

  it("returns false when neither is set", () => {
    clearCiEnv();
    expect(hasPlatformEnv()).toBe(false);
  });
});

describe("detectCI", () => {
  beforeEach(clearCiEnv);

  it("returns null outside CI", () => {
    expect(detectCI()).toBeNull();
  });

  it("detects GitHub Actions", () => {
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_SHA = "abc1234";
    process.env.GITHUB_REF_NAME = "main";
    process.env.GITHUB_REPOSITORY = "acme/payment-api";
    process.env.GITHUB_REPOSITORY_OWNER = "acme";

    const ci = detectCI();
    expect(ci).not.toBeNull();
    expect(ci?.gitSha).toBe("abc1234");
    expect(ci?.branch).toBe("main");
    expect(ci?.githubRepo).toBe("https://github.com/acme/payment-api");
    expect(ci?.owner).toBe("acme");
  });

  it("detects GitLab CI", () => {
    process.env.GITLAB_CI = "true";
    process.env.CI_COMMIT_SHA = "def5678";
    process.env.CI_COMMIT_REF_NAME = "feature/x";
    process.env.CI_PROJECT_PATH = "acme/api";
    process.env.CI_PROJECT_NAMESPACE = "acme";

    const ci = detectCI();
    expect(ci).not.toBeNull();
    expect(ci?.gitSha).toBe("def5678");
    expect(ci?.branch).toBe("feature/x");
    expect(ci?.namespace).toBe("acme/api");
  });

  it("detects Bitbucket Pipelines", () => {
    process.env.BITBUCKET_BUILD_NUMBER = "42";
    process.env.BITBUCKET_COMMIT = "ghi9012";
    process.env.BITBUCKET_BRANCH = "develop";
    process.env.BITBUCKET_WORKSPACE = "acme";
    process.env.BITBUCKET_REPO_SLUG = "payment-api";

    const ci = detectCI();
    expect(ci).not.toBeNull();
    expect(ci?.gitSha).toBe("ghi9012");
    expect(ci?.branch).toBe("develop");
    expect(ci?.namespace).toBe("acme/payment-api");
  });
});
