import { detectCI, getGitBranch, getGitShaForFile } from "./ci-detect.js";

export interface GitProvenance {
  gitSha: string;
  githubRepo: string;
  githubBranch: string;
}

export interface GitProvenanceOpts {
  gitSha?: string;
  githubRepo?: string;
  githubBranch?: string;
}

/**
 * Resolve git provenance (commit SHA, repository URL, branch) for a publish/push
 * call. Each field is resolved independently with the priority:
 *
 *   gitSha:       --git-sha flag > CI env > local git log on the spec file
 *   githubRepo:   --github-repo flag > CI env (no local fallback — would require
 *                                       parsing `git remote` output)
 *   githubBranch: --github-branch flag > CI env > local git current branch
 *
 * Returns empty strings when no source supplied a value; callers should treat
 * `""` as "field absent" when constructing the request payload.
 *
 * Independent resolution matters in CI: when the caller passes an explicit
 * `--git-sha` (common in GitHub Actions where `GITHUB_SHA` is the authoritative
 * commit), the CI auto-derive for `githubRepo` and `githubBranch` must still
 * fire — otherwise the platform never learns the source repository.
 *
 * @param opts caller-supplied explicit values (typically from CLI flags)
 * @param specFilePath spec file path, used by the local-git fallback to look
 *                     up the last commit that touched the file
 */
export function resolveGitProvenance(opts: GitProvenanceOpts, specFilePath: string): GitProvenance {
  let gitSha = opts.gitSha ?? "";
  let githubRepo = opts.githubRepo ?? "";
  let githubBranch = opts.githubBranch ?? "";

  const ci = detectCI();
  if (ci) {
    // CI env supplements anything the caller didn't explicitly set. Flags win
    // per-field — passing `--git-sha` alone must NOT suppress `githubRepo` /
    // `githubBranch` auto-derive.
    gitSha = gitSha || (ci.gitSha ?? "");
    githubRepo = githubRepo || (ci.githubRepo ?? "");
    githubBranch = githubBranch || (ci.branch ?? "");
  } else if (!gitSha) {
    // Not in CI and no explicit sha — fall back to local git on the spec file.
    // The local fallback for githubRepo is intentionally absent: deriving a
    // canonical https://github.com/... URL from `git remote` is brittle (ssh
    // remotes, forks, mirrors) and the platform doesn't strictly need it for
    // local development.
    const localSha = getGitShaForFile(specFilePath);
    if (localSha) {
      gitSha = localSha;
      githubBranch = githubBranch || (getGitBranch() ?? "");
    }
  }

  return { gitSha, githubRepo, githubBranch };
}
