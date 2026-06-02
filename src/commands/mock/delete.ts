/**
 * spec0 mock delete <api> — delete the mock server tied to <api>.
 *
 * No GET/DELETE-by-id-only endpoint, so we resolve the mock server id by
 * listing mocks and filtering by API name or id (same as `mock show`), then
 * PublicMocksService.deletePublicMock (`DELETE /api/v1/public/mocks/{id}`).
 * Requires `--yes`.
 */

import { Command } from "commander";
import chalk from "chalk";
import { PublicMocksService } from "@spec0/sdk-public-platform";
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

export function registerMockDeleteCommand(mock: Command) {
  mock
    .command("delete <api>")
    .description("Delete the mock server tied to <api> (name or UUID). Requires --yes.")
    .option("--yes", "Skip the confirmation prompt (required for non-interactive use)")
    .option("--org <uuid>", "Org id override")
    .option("--output <format>", "Output format: text, json, or yaml (default: text)")
    .action(async (api: string, opts: OutputOptions & { yes?: boolean; org?: string }) => {
      const outCtx = resolveOutputContext(opts);

      if (!api.trim()) {
        fail(outCtx, ExitCode.USAGE, "API ref is required.");
      }
      if (!opts.yes) {
        fail(
          outCtx,
          ExitCode.USAGE,
          "Refusing to delete without confirmation. Pass --yes to proceed.",
          { hint: "spec0 mock delete <api> --yes" },
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
      try {
        const rows = await PublicMocksService.listPublicMocks();
        const needle = api.toLowerCase();
        const hit = rows.find(
          (r) =>
            (r.apiName ?? "").toLowerCase() === needle || (r.apiId ?? "").toLowerCase() === needle,
        );
        if (!hit?.mockServerId) {
          fail(outCtx, ExitCode.NOT_FOUND, `No mock server found for '${api}'.`, {
            hint: "Run 'spec0 mock list' to see existing mocks.",
          });
        }
        await PublicMocksService.deletePublicMock({ mockServerId: hit.mockServerId });
        progress(
          outCtx,
          chalk.green(`✓ Deleted mock server for ${hit.apiName ?? api} (${hit.mockServerId})`),
        );
      } catch (err) {
        if (is401(err)) {
          fail(outCtx, ExitCode.AUTH_MISSING, "Token invalid or expired.", {
            hint: "Run 'spec0 auth login' or refresh SPEC0_TOKEN.",
          });
        }
        const status = errorStatusCode(err);
        const msg = extractErrorMessage(err) ?? (err as Error).message;
        fail(
          outCtx,
          status ? exitCodeForHttpStatus(status) : ExitCode.GENERIC,
          `mock delete failed: ${msg}`,
        );
      }
    });
}
