#!/usr/bin/env node

import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerInitCommand } from "./commands/init.js";
import { registerPublishCommand } from "./commands/publish.js";
import { registerRegisterCommand } from "./commands/register.js";
import { registerMockCommands } from "./commands/mock.js";
import { registerLintCommand } from "./commands/lint.js";
import { registerPullCommand } from "./commands/pull.js";
import { registerSearchCommand } from "./commands/search.js";
import { registerDiffCommand } from "./commands/diff.js";
import { registerLogCommand } from "./commands/log.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerTeamCommands } from "./commands/team.js";
import { registerMcpCommands } from "./commands/mcp.js";
import { registerVersionCommand } from "./commands/version.js";
import { getCliVersion } from "./lib/version.js";

const program = new Command();

program
  .name("winspect")
  .description("Winspect CLI — register API specs, create mock servers, lint, and interact with the Winspect SaaS")
  .version(getCliVersion(), "-V, --cli-version", "Print CLI version")
  .option(
    "--spec-file <path>",
    "Path to OpenAPI spec (optional; use before register/lint, or use register --spec-file)"
  );

registerVersionCommand(program);
registerAuthCommands(program);
registerInitCommand(program);
registerRegisterCommand(program);
registerPublishCommand(program);
registerMockCommands(program);
registerLintCommand(program);
registerPullCommand(program);
registerSearchCommand(program);
registerDiffCommand(program);
registerLogCommand(program);
registerStatusCommand(program);
registerTeamCommands(program);
registerMcpCommands(program);

program.parse();
