/**
 * spec0 sync-status — does this spec need re-publishing?
 *
 * Migrated to PublicSpecsService.getSyncStatus (`/api/v1/public/specs/sync-status`).
 * CI uses the result to skip a no-op `spec0 publish` when the git SHA matches
 * the last published version.
 *
 * Exit semantics:
 *   - 0 always on successful lookup (even if `needsPublish` is true). The
 *     answer is in the output; the shell decides what to do with it.
 *   - 3/4/5/9/10 on the usual auth/network/backend failure modes.
 */

import { Command } from "commander";
import { execSync } from "node:child_process";
import chalk from "chalk";
import { PublicSpecsService } from "@spec0/sdk-public-platform";
import type { SyncStatusResponseV1 } from "@spec0/sdk-public-platform";
import { configureSdkAuth, errorStatusCode, is401 } from "../lib/api-client.js";
import { requireOrgContext } from "../lib/auth-context.js";
import { ExitCode } from "../lib/exit-codes.js";
import { emit, fail, resolveOutputContext, type OutputOptions } from "../lib/output/index.js";
import { resolveRef } from "../lib/ref-resolver.js";

export function registerSyncStatusCommand(program: Command) {
  program
    .command("sync-status")
    .description("Check whether a spec needs republishing (compares git SHA to last published).")
    .argument("[ref]", "API reference: <org>/<name>, <name>, or UUID")
    .option("--git-sha <sha>", "Git SHA to compare against (default: HEAD of current repo)")
    .option("--api <name>", "API name (alternative to positional ref)")
    .option("--api-id <uuid>", "API id (alternative to positional ref)")
    .option("--org <uuid>", "Org id override")
    .option("--output <format>", "Output format: text, json, or yaml (default: text)")
    .action(
      async (
        refArg: string | undefined,
        opts: OutputOptions & {
          gitSha?: string;
          api?: string;
          apiId?: string;
          org?: string;
        },
      ) => {
        const outCtx = resolveOutputContext(opts);

        let authCtx;
        try {
          authCtx = requireOrgContext(opts.org);
        } catch (e) {
          fail(outCtx, ExitCode.AUTH_MISSING, (e as Error).message, {
            hint: "Set SPEC0_TOKEN + SPEC0_ORG_ID, or run 'spec0 auth login'.",
          });
        }

        const { apiId, apiName } = resolveIdentifier(refArg, opts);
        if (!apiId && !apiName) {
          fail(
            outCtx,
            ExitCode.USAGE,
            "Provide a ref (e.g. 'acme/orders'), --api <name>, or --api-id <uuid>.",
          );
        }

        const gitSha = opts.gitSha ?? detectGitSha();
        if (!gitSha) {
          fail(outCtx, ExitCode.USAGE, "Could not auto-detect git SHA (not a git repo?).", {
            hint: "Pass --git-sha <sha> explicitly.",
          });
        }

        configureSdkAuth(authCtx);
        try {
          const res = await PublicSpecsService.getSyncStatus({
            gitSha,
            apiId,
            name: apiName,
          });
          emit(outCtx, res, renderText);
        } catch (err) {
          if (is401(err)) {
            fail(outCtx, ExitCode.AUTH_MISSING, "Token invalid or expired.", {
              hint: "Run 'spec0 auth login' or refresh SPEC0_TOKEN.",
            });
          }
          const status = errorStatusCode(err);
          if (status === 404) {
            fail(outCtx, ExitCode.NOT_FOUND, `API '${apiName ?? apiId}' not found.`, {
              hint: "Run 'spec0 api list' to see what exists in this org.",
            });
          }
          fail(outCtx, ExitCode.GENERIC, `sync-status failed: ${(err as Error).message}`);
        }
      },
    );
}

function resolveIdentifier(
  refArg: string | undefined,
  opts: { api?: string; apiId?: string },
): { apiId?: string; apiName?: string } {
  if (opts.apiId) return { apiId: opts.apiId };
  if (opts.api) return { apiName: opts.api };
  if (!refArg) return {};
  const parsed = resolveRef(refArg);
  if (parsed.kind === "uuid") return { apiId: parsed.apiId };
  return { apiName: parsed.api };
}

function detectGitSha(): string | undefined {
  try {
    return execSync("git rev-parse HEAD", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

function renderText(res: SyncStatusResponseV1): string {
  const lines: string[] = [];
  if (res.needsPublish) {
    lines.push(chalk.yellow("● needs publish"));
  } else {
    lines.push(chalk.green("● up to date"));
  }
  lines.push("");
  if (res.lastPublishedVersion) {
    lines.push(`  last version:  ${res.lastPublishedVersion}`);
  }
  if (res.lastPublishedSha) {
    lines.push(`  last sha:      ${res.lastPublishedSha.slice(0, 12)}`);
  } else {
    lines.push(`  last sha:      (never published)`);
  }
  return lines.join("\n");
}
