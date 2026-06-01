/**
 * spec0 api delete <ref> — delete a team-scoped API.
 *
 * Uses PublicApisService.deleteTeamApi (`DELETE /api/v1/public/apis/team/{apiId}`).
 * Resolves <ref> (name or UUID) via the shared ref-resolver. Requires `--yes`.
 * Mirrors `spec0 team delete`'s destructive-op contract.
 */

import { Command } from "commander";
import chalk from "chalk";
import { PublicApisService } from "@spec0/sdk-public-platform";
import {
  configureSdkAuth,
  errorStatusCode,
  is401,
  extractErrorMessage,
} from "../../lib/api-client.js";
import { requireOrgContext } from "../../lib/auth-context.js";
import { ExitCode, exitCodeForHttpStatus } from "../../lib/exit-codes.js";
import {
  fail,
  progress,
  resolveOutputContext,
  type OutputOptions,
} from "../../lib/output/index.js";
import { resolveRef, resolveApiId } from "../../lib/ref-resolver.js";

export function registerApiDeleteCommand(api: Command) {
  api
    .command("delete <ref>")
    .description("Delete a team-scoped API (name or UUID). Requires --yes.")
    .option("--yes", "Skip the confirmation prompt (required for non-interactive use)")
    .option("--org <uuid>", "Org id override")
    .option("--output <format>", "Output format: text, json, or yaml (default: text)")
    .action(async (ref: string, opts: OutputOptions & { yes?: boolean; org?: string }) => {
      const outCtx = resolveOutputContext(opts);

      if (!ref.trim()) {
        fail(outCtx, ExitCode.USAGE, "API ref is required.");
      }
      if (!opts.yes) {
        fail(
          outCtx,
          ExitCode.USAGE,
          "Refusing to delete without confirmation. Pass --yes to proceed.",
          { hint: "spec0 api delete <ref> --yes" },
        );
      }

      let authCtx;
      try {
        authCtx = requireOrgContext(opts.org);
      } catch (e) {
        fail(outCtx, ExitCode.AUTH_MISSING, (e as Error).message, {
          hint: "Set SPEC0_TOKEN + SPEC0_ORG_ID, or run 'spec0 auth login'.",
        });
      }

      configureSdkAuth(authCtx);

      let apiId: string;
      try {
        apiId = await resolveApiId(resolveRef(ref, { defaultOrg: authCtx.orgName }));
      } catch (e) {
        fail(outCtx, ExitCode.NOT_FOUND, (e as Error).message, {
          hint: "Run 'spec0 api list' to see what exists in this org.",
        });
      }

      try {
        await PublicApisService.deleteTeamApi({ apiId });
        progress(outCtx, chalk.green(`✓ Deleted API ${ref} (${apiId})`));
      } catch (err) {
        if (is401(err)) {
          fail(outCtx, ExitCode.AUTH_MISSING, "Token invalid or expired.", {
            hint: "Run 'spec0 auth login' or refresh SPEC0_TOKEN.",
          });
        }
        const status = errorStatusCode(err);
        const msg = extractErrorMessage(err) ?? (err as Error).message;
        if (status === 404) {
          fail(outCtx, ExitCode.NOT_FOUND, `API ${ref} not found.`, {
            hint: "Run 'spec0 api list' to see what exists in this org.",
          });
        }
        fail(
          outCtx,
          status ? exitCodeForHttpStatus(status) : ExitCode.GENERIC,
          `api delete failed: ${msg}`,
        );
      }
    });
}
