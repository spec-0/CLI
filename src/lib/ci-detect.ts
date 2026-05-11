/**
 * CI environment auto-detection + local git metadata
 * Priority: CLI flags > PLATFORM_* env vars > .spec0.yaml > CI env > local git
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve, dirname } from "path";

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

/**
 * Returns true if the given directory (or any parent) contains a .git directory.
 */
function hasGitRepo(startDir: string): boolean {
  let dir = resolve(startDir);
  // Walk up max 10 levels to avoid infinite loop
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, ".git"))) return true;
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return false;
}

/**
 * Get the git commit SHA of the last commit that touched a specific file.
 * Uses `git log -1 --format=%H -- <file>` so the SHA reflects when the spec
 * actually changed, not just the HEAD commit.
 *
 * Returns null if not in a git repo or git is not available.
 */
export function getGitShaForFile(specFilePath: string): string | null {
  const dir = dirname(resolve(specFilePath));
  if (!hasGitRepo(dir)) return null;
  try {
    const sha = execSync(`git log -1 --format=%H -- "${specFilePath}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    }).trim();
    return sha || null;
  } catch {
    return null;
  }
}

/**
 * Get the current HEAD commit SHA (repo-level, not file-specific).
 * Falls back to getGitShaForFile when a spec path is available.
 */
export function getGitHeadSha(): string | null {
  if (!hasGitRepo(process.cwd())) return null;
  try {
    const sha = execSync("git rev-parse HEAD", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    }).trim();
    return sha || null;
  } catch {
    return null;
  }
}

/**
 * Get the current branch name.
 */
export function getGitBranch(): string | null {
  if (!hasGitRepo(process.cwd())) return null;
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    }).trim();
    return branch && branch !== "HEAD" ? branch : null;
  } catch {
    return null;
  }
}

export function getGitMetadata(): Partial<CIDetectedContext> {
  return {};
}

export function hasPlatformEnv(): boolean {
  const token = process.env.SPEC0_TOKEN ?? process.env.PLATFORM_API_TOKEN;
  const orgId = process.env.SPEC0_ORG_ID ?? process.env.PLATFORM_ORG_ID;
  return !!(token && orgId);
}
