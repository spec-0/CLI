/**
 * spec0 mock url <api> — single-line URL emitter for CI one-liners.
 *
 * Intentionally terse: prints the resolved mock URL and nothing else so it can
 * be captured straight into a shell var (`export MOCK=$(spec0 mock url foo)`).
 * For a richer view, use `spec0 mock show`.
 *
 * Migrated to `PublicMocksService.listPublicMocks` — the backend has no
 * point-lookup endpoint so we still list-and-filter, just over the SDK now.
 */

import { Command } from "commander";
import { PublicMocksService } from "@spec0/sdk-public-platform";
import { configureSdkAuth, is401 } from "../../lib/api-client.js";
import { requireOrgContext } from "../../lib/auth-context.js";
import { ExitCode, exit } from "../../lib/exit-codes.js";

export function registerMockUrlCommand(mock: Command) {
  mock
    .command("url <api>")
    .description("Print mock base URL for <api> (name or UUID). One line, pipe-friendly.")
    .option("--org <uuid>", "Org id override")
    .action(async (api: string, opts: { org?: string }) => {
      let authCtx;
      try {
        authCtx = requireOrgContext(opts.org);
      } catch (e) {
        exit(ExitCode.AUTH_MISSING, (e as Error).message);
      }

      configureSdkAuth(authCtx);
      try {
        const rows = await PublicMocksService.listPublicMocks();
        const needle = api.toLowerCase();
        const hit = rows.find(
          (r) =>
            (r.apiName ?? "").toLowerCase() === needle || (r.apiId ?? "").toLowerCase() === needle,
        );
        if (!hit) {
          exit(ExitCode.NOT_FOUND, `No mock server found for '${api}'.`);
        }
        process.stdout.write(`${authCtx.apiUrl}${hit.mockBaseUrl ?? ""}\n`);
      } catch (err) {
        if (is401(err)) {
          exit(ExitCode.AUTH_MISSING, "Token invalid or expired. Run 'spec0 auth login'.");
        }
        exit(ExitCode.GENERIC, `mock url failed: ${(err as Error).message}`);
      }
    });
}
