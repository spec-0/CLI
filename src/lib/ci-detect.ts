/**
 * CI environment auto-detection
 * Priority: CLI flags > PLATFORM_* env vars > .winspect.yaml > CI env > git metadata
 */

export interface CIDetectedContext {
  name: string;
  namespace: string;
  owner: string;
  gitSha: string;
  branch: string;
  githubRepo?: string;
}

export function detectCI(): CIDetectedContext | null {
  if (process.env.GITHUB_ACTIONS === "true") {
    const repo = process.env.GITHUB_REPOSITORY ?? "";
    const owner = process.env.GITHUB_REPOSITORY_OWNER ?? process.env.PLATFORM_OWNER ?? "";
    const name = repo.split("/").pop() ?? process.env.PLATFORM_NAME ?? "unknown";
    return {
      name,
      namespace: repo || "unknown",
      owner,
      gitSha: process.env.GITHUB_SHA ?? "",
      branch: process.env.GITHUB_REF_NAME ?? "",
      githubRepo: repo ? `https://github.com/${repo}` : undefined,
    };
  }

  if (process.env.GITLAB_CI === "true") {
    const path = process.env.CI_PROJECT_PATH ?? "";
    const ns = process.env.CI_PROJECT_NAMESPACE ?? process.env.PLATFORM_OWNER ?? "";
    const name = process.env.CI_PROJECT_NAME ?? path.split("/").pop() ?? "unknown";
    return {
      name,
      namespace: path || "unknown",
      owner: ns,
      gitSha: process.env.CI_COMMIT_SHA ?? "",
      branch: process.env.CI_COMMIT_REF_NAME ?? "",
      githubRepo: process.env.CI_PROJECT_URL,
    };
  }

  if (process.env.BITBUCKET_BUILD_NUMBER) {
    const workspace = process.env.BITBUCKET_WORKSPACE ?? "";
    const slug = process.env.BITBUCKET_REPO_SLUG ?? "";
    const ns = process.env.BITBUCKET_REPO_OWNER ?? process.env.PLATFORM_OWNER ?? "";
    const name = slug || "unknown";
    const namespace = workspace && slug ? `${workspace}/${slug}` : "unknown";
    return {
      name,
      namespace,
      owner: ns,
      gitSha: process.env.BITBUCKET_COMMIT ?? "",
      branch: process.env.BITBUCKET_BRANCH ?? "",
      githubRepo: process.env.BITBUCKET_GIT_HTTP_ORIGIN,
    };
  }

  return null;
}

export function getGitMetadata(): Partial<CIDetectedContext> {
  // Fallback: would use child_process to run git commands
  // For now return empty; actual impl would execSync git rev-parse, etc.
  return {};
}

export function hasPlatformEnv(): boolean {
  return !!(process.env.PLATFORM_API_TOKEN && process.env.PLATFORM_ORG_ID);
}
