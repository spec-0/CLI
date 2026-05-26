import { resolveGitProvenance } from "../src/lib/git-provenance.js";

const CI_ENV_KEYS = [
  "CI",
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
  "CI_PROJECT_NAME",
];

const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const k of CI_ENV_KEYS) savedEnv[k] = process.env[k];
});

beforeEach(() => {
  for (const k of CI_ENV_KEYS) delete process.env[k];
});

afterAll(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("resolveGitProvenance — GitHub Actions env", () => {
  beforeEach(() => {
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_SHA = "ci-sha-abc1234";
    process.env.GITHUB_REF_NAME = "main";
    process.env.GITHUB_REPOSITORY = "acme/payment-api";
    process.env.GITHUB_REPOSITORY_OWNER = "acme";
  });

  it("derives all three fields when no flags are passed", () => {
    const result = resolveGitProvenance({}, "openapi.yaml");
    expect(result.gitSha).toBe("ci-sha-abc1234");
    expect(result.githubRepo).toBe("https://github.com/acme/payment-api");
    expect(result.githubBranch).toBe("main");
  });

  it("explicit --git-sha does not suppress CI-derived githubRepo + branch", () => {
    // Regression guard: previously the CI auto-derive was nested inside an
    // `if (!gitSha)` block, so passing --git-sha skipped the derive entirely
    // and the publish payload went out with empty repo + branch.
    const result = resolveGitProvenance({ gitSha: "explicit-sha" }, "openapi.yaml");
    expect(result.gitSha).toBe("explicit-sha");
    expect(result.githubRepo).toBe("https://github.com/acme/payment-api");
    expect(result.githubBranch).toBe("main");
  });

  it("explicit --github-repo overrides CI-derived value", () => {
    const result = resolveGitProvenance(
      { githubRepo: "https://github.com/flag-org/flag-repo" },
      "openapi.yaml",
    );
    expect(result.gitSha).toBe("ci-sha-abc1234");
    expect(result.githubRepo).toBe("https://github.com/flag-org/flag-repo");
    expect(result.githubBranch).toBe("main");
  });

  it("explicit --github-branch overrides CI-derived value", () => {
    const result = resolveGitProvenance({ githubBranch: "feature/x" }, "openapi.yaml");
    expect(result.gitSha).toBe("ci-sha-abc1234");
    expect(result.githubRepo).toBe("https://github.com/acme/payment-api");
    expect(result.githubBranch).toBe("feature/x");
  });

  it("all explicit flags win over CI", () => {
    const result = resolveGitProvenance(
      {
        gitSha: "flag-sha",
        githubRepo: "https://github.com/flag-org/flag-repo",
        githubBranch: "flag-branch",
      },
      "openapi.yaml",
    );
    expect(result).toEqual({
      gitSha: "flag-sha",
      githubRepo: "https://github.com/flag-org/flag-repo",
      githubBranch: "flag-branch",
    });
  });
});

describe("resolveGitProvenance — GitLab CI env", () => {
  beforeEach(() => {
    process.env.GITLAB_CI = "true";
    process.env.CI_COMMIT_SHA = "gl-sha-xyz789";
    process.env.CI_COMMIT_REF_NAME = "develop";
    process.env.CI_PROJECT_PATH = "team/svc";
    process.env.CI_PROJECT_NAMESPACE = "team";
    process.env.CI_PROJECT_NAME = "svc";
  });

  it("explicit --git-sha does not suppress CI-derived branch (githubRepo is GitHub-only)", () => {
    // GitLab CI populates gitSha and branch but not githubRepo (since it's a
    // GitHub-specific URL). The regression guard still applies for branch.
    const result = resolveGitProvenance({ gitSha: "explicit-sha" }, "openapi.yaml");
    expect(result.gitSha).toBe("explicit-sha");
    expect(result.githubBranch).toBe("develop");
  });
});

describe("resolveGitProvenance — no CI env", () => {
  it("returns empty repo when no CI and no flag (no local fallback for repo URL)", () => {
    // With no CI env, deriving a repo URL would require parsing `git remote`
    // output — intentionally not supported. Caller must pass --github-repo or
    // run under CI.
    const result = resolveGitProvenance(
      { githubRepo: undefined },
      "/tmp/__definitely_does_not_exist_spec__.yaml",
    );
    expect(result.githubRepo).toBe("");
  });
});
