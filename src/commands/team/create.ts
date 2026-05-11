/**
 * spec0 team create — create a new team in the org.
 *
 * Uses PublicTeamsService.createTeam (`POST /api/v1/public/teams`).
 * Requires `admin:team` scope on the calling token.
 */

import { Command } from "commander";
import { PublicTeamsService } from "@spec0/sdk-public-platform";
import type { TeamV1 } from "@spec0/sdk-public-platform";
import {
  configureSdkAuth,
  errorStatusCode,
  is401,
  extractErrorMessage,
} from "../../lib/api-client.js";
import { requireOrgContext } from "../../lib/auth-context.js";
import { ExitCode, exitCodeForHttpStatus } from "../../lib/exit-codes.js";
import { emit, fail, resolveOutputContext, type OutputOptions } from "../../lib/output/index.js";

export function registerTeamCreateCommand(team: Command) {
  team
    .command("create <name>")
    .description("Create a new team in the org. Requires admin:team scope.")
    .option("--description <text>", "Optional team description")
    .option("--org <uuid>", "Org id override")
    .option("--output <format>", "Output format: text, json, or yaml (default: text)")
    .action(async (name: string, opts: OutputOptions & { description?: string; org?: string }) => {
      const outCtx = resolveOutputContext(opts);

      const trimmed = name.trim();
      if (!trimmed) {
        fail(outCtx, ExitCode.USAGE, "Team name is required and must be non-blank.");
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
        const created = (await PublicTeamsService.createTeam({
          requestBody: {
            name: trimmed,
            description: opts.description,
          },
        })) as TeamV1;
        emit(outCtx, created, (t) => `Created team: ${t.name} (${t.id})`);
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
          `team create failed: ${msg}`,
        );
      }
    });
}
