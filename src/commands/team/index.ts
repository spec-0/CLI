/**
 * spec0 team … — team management subcommands.
 *
 * Mirrors the `spec0 mock` group's split-per-verb shape (each verb owns its
 * flags, exit codes, and output contract). Backed by V1 endpoints on
 * `@spec0/sdk-public-platform.PublicTeamsService`.
 */

import { Command } from "commander";
import { registerTeamCreateCommand } from "./create.js";
import { registerTeamDeleteCommand } from "./delete.js";
import { registerTeamListCommand } from "./list.js";

export function registerTeamCommands(program: Command) {
  const team = program.command("team").description("Team management");
  registerTeamCreateCommand(team);
  registerTeamDeleteCommand(team);
  registerTeamListCommand(team);
}
