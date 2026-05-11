/**
 * spec0 team list — one row per team in the org.
 *
 * Uses PublicTeamsService.listTeams (`/api/v1/public/teams`).
 */

import { Command } from "commander";
import { PublicTeamsService } from "@spec0/sdk-public-platform";
import type { TeamV1 } from "@spec0/sdk-public-platform";
import { configureSdkAuth, errorStatusCode, is401 } from "../../lib/api-client.js";
import { requireOrgContext } from "../../lib/auth-context.js";
import { ExitCode, exitCodeForHttpStatus } from "../../lib/exit-codes.js";
import { emit, fail, resolveOutputContext, type OutputOptions } from "../../lib/output/index.js";
import { renderTable } from "../../lib/output/table.js";

export function registerTeamListCommand(team: Command) {
  team
    .command("list")
    .description("List all teams in the org.")
    .option("--org <uuid>", "Org id override")
    .option("--output <format>", "Output format: text, json, or yaml (default: text)")
    .action(async (opts: OutputOptions & { org?: string }) => {
      const outCtx = resolveOutputContext(opts);

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
        const rows = (await PublicTeamsService.listTeams()) as TeamV1[];
        emit(outCtx, rows, (data) =>
          renderTable(data as unknown as Record<string, unknown>[], [
            { key: "id", header: "Id" },
            { key: "name", header: "Name" },
            { key: "description", header: "Description" },
          ]),
        );
      } catch (err) {
        if (is401(err)) {
          fail(outCtx, ExitCode.AUTH_MISSING, "Token invalid or expired.", {
            hint: "Run 'spec0 auth login' or refresh SPEC0_TOKEN.",
          });
        }
        const status = errorStatusCode(err);
        fail(
          outCtx,
          status ? exitCodeForHttpStatus(status) : ExitCode.GENERIC,
          `team list failed: ${(err as Error).message}`,
        );
      }
    });
}
